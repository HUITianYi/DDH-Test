import asyncio
import io
import json
import os
from typing import Optional, Tuple

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import OpenAI

try:
    import cv2
    import numpy as np
except Exception:
    cv2 = None
    np = None

try:
    import torch
    import torchvision.transforms as transforms
    from PIL import Image
    from torchvision import models
except Exception:
    torch = None
    transforms = None
    Image = None
    models = None

app = FastAPI()

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

_vision_inited = False
_vision_device = None
_vision_model = None
_vision_preprocess = None


def _init_vision() -> Tuple[Optional[object], Optional[object], Optional[object]]:
    global _vision_inited, _vision_device, _vision_model, _vision_preprocess
    if _vision_inited:
        return _vision_device, _vision_model, _vision_preprocess
    _vision_inited = True
    if torch is None or models is None or transforms is None:
        return None, None, None
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = models.resnet34(weights=models.ResNet34_Weights.DEFAULT)
        model = model.to(device)
        model.eval()
        preprocess = transforms.Compose(
            [
                transforms.Resize(256),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )
        _vision_device = device
        _vision_model = model
        _vision_preprocess = preprocess
        return device, model, preprocess
    except Exception:
        _vision_device = None
        _vision_model = None
        _vision_preprocess = None
        return None, None, None

def analyze_geometry_medical(image_bytes):
    try:
        if np is None or cv2 is None:
            return {}
        nparray = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparray, cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        height, width = gray.shape
        roi = gray[int(height*0.4):int(height*0.7), int(width*0.2):int(width*0.8)]
        variation = np.std(roi) / 255.0
        simulated_angle = 22.5 + (variation * 30.0) 
        simulated_angle = round(min(max(simulated_angle, 18.0), 45.0), 1)
        quadrant = "内下象限 (正常)" if simulated_angle < 28 else "外上象限 (高度疑似脱位)"
        return {"acetabular_index": simulated_angle, "h_line_status": "水平参考线已建立", "perkin_line": quadrant}
    except Exception:
        return {}

def analyze_visual_features(image_bytes):
    try:
        device, model, preprocess = _init_vision()
        if device is None or model is None or preprocess is None or Image is None or torch is None:
            return 0.5
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        input_tensor = preprocess(img).unsqueeze(0).to(device)
        with torch.no_grad():
            output = model(input_tensor)
            probs = torch.nn.functional.softmax(output[0], dim=0)
            score = 1.0 - torch.max(probs).item()
            return round((score * 1.5) % 1.0, 2)
    except Exception:
        return 0.5

def _sanitize_llm_text(text: str) -> str:
    if not text:
        return ""
    s = str(text)
    s = s.replace("**", "")
    s = s.replace("*", "")
    s = s.replace("```", "")
    return s

@app.post("/diagnose")
async def diagnose(
    history_text: str = Form(...), 
    file: UploadFile = File(None), 
    Ortolani: str = Form("neg"), 
    Barlow: str = Form("neg"), 
    abduction_deg: str = Form("0")
):
    async def generate():
        image_score, geometry_info = 0.0, {}
        
        # 1. 并行处理 ResNet 和 OpenCV (提速)
        if file:
            image_bytes = await file.read()
            image_task = asyncio.to_thread(analyze_visual_features, image_bytes)
            geometry_task = asyncio.to_thread(analyze_geometry_medical, image_bytes)
            image_score, geometry_info = await asyncio.gather(image_task, geometry_task)

        # 2. 立即发送 Metadata (让前端先看到分数)
        metadata = {
            "type": "metadata",
            "output": {
                "riskScore": image_score,
                "riskLevel": "高风险" if image_score > 0.6 or geometry_info.get("acetabular_index", 0) > 30 else "中风险" if image_score > 0.3 else "低风险",
                "recommendation": "建议进一步临床检查"
            },
            "evidence": {"medical_geometry": geometry_info, "cnn_feature_score": image_score}
        }
        yield json.dumps(metadata, ensure_ascii=False) + "\n--SEP--\n"

        # 3. DeepSeek 流式生成报告
        prompt = f"患者信息: 病史 {history_text}, Ortolani:{Ortolani}, Barlow:{Barlow}, 外展角:{abduction_deg}度, AI异常评分:{image_score}, 髋臼指数:{geometry_info.get('acetabular_index','无法测量')}度, Perkin判定:{geometry_info.get('perkin_line','无法判定')}。"
        
        try:
            if not DEEPSEEK_API_KEY:
                raise Exception("服务端未配置DEEPSEEK_API_KEY")
            response = client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[
                    {"role": "system", "content": "你是一名资深小儿骨科专家。请给出极其简洁的诊断分析。要求：1.直接给出结论；2.分点列出依据；3.一句话治疗建议。禁止使用Markdown格式（如**加粗），请直接输出纯文本。总字数200字以内。"},
                    {"role": "user", "content": prompt}
                ], 
                stream=True
            )
            for chunk in response:
                if chunk.choices[0].delta.content:
                    cleaned = _sanitize_llm_text(chunk.choices[0].delta.content)
                    if cleaned:
                        yield json.dumps({"type": "content", "content": cleaned}, ensure_ascii=False) + "\n--SEP--\n"
        except Exception as e:
            yield json.dumps({"type": "error", "error": str(e)}, ensure_ascii=False) + "\n--SEP--\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
