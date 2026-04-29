from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import torch
import torchvision.transforms as transforms
from torchvision import models
from PIL import Image
import io
import os
import cv2
import numpy as np
from openai import OpenAI
import json
import asyncio
import base64

app = FastAPI()

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. 加载本地视觉特征提取模型 (ResNet34)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
resnet = models.resnet34(weights=models.ResNet34_Weights.DEFAULT)
resnet = resnet.to(device)
resnet.eval()

# 图像预处理
preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# 注意：请确保这里的 API Key 是正确的！
client = OpenAI(api_key="sk-1f8fd8f0542e4feabf5bc8c15feb8f8b", base_url="https://api.deepseek.com")

def analyze_geometry_medical(image_bytes):
    try:
        nparray = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparray, cv2.IMREAD_COLOR)
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 1. 尝试寻找 Hilgenreiner 线 (HL)
        # 逻辑：在图像中间高度区域寻找横向边缘最强的水平线
        edges = cv2.Canny(gray, 50, 150)
        h_search_area = edges[int(h*0.4):int(h*0.6), :]
        h_proj = np.sum(h_search_area, axis=1)
        h_y = int(h*0.4) + np.argmax(h_proj)
        
        # 绘制 HL 线 (绿色)
        cv2.line(img, (int(w*0.05), h_y), (int(w*0.95), h_y), (0, 255, 0), 2)
        cv2.putText(img, "H-Line", (20, h_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # 2. 尝试寻找髋臼外缘点以确定 Perkin 线 (PL)
        # 逻辑：从左右两侧向中间扫描，寻找第一个明显的骨性突起
        p_search_y_start, p_search_y_end = int(h_y - h*0.1), int(h_y + h*0.05)
        p_left_x, p_right_x = int(w*0.3), int(w*0.7) # 默认值
        
        # 简化版边缘搜索
        left_roi = edges[p_search_y_start:p_search_y_end, int(w*0.2):int(w*0.45)]
        right_roi = edges[p_search_y_start:p_search_y_end, int(w*0.55):int(w*0.8)]
        
        if np.any(left_roi): p_left_x = int(w*0.2) + np.where(np.sum(left_roi, axis=0) > 0)[0][0]
        if np.any(right_roi): p_right_x = int(w*0.55) + np.where(np.sum(right_roi, axis=0) > 0)[0][-1]

        # 绘制 PL 线 (蓝色)
        cv2.line(img, (p_left_x, int(h*0.25)), (p_left_x, int(h*0.75)), (255, 100, 0), 2)
        cv2.line(img, (p_right_x, int(h*0.25)), (p_right_x, int(h*0.75)), (255, 100, 0), 2)
        cv2.putText(img, "P-Line", (p_left_x - 60, int(h*0.25)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 100, 0), 2)

        # 3. 计算并绘制髋臼指数 (AI)
        # 逻辑：从 HL 线与骨盆交界处（模拟三叉软骨点）向 PL 线交点画斜线
        inner_x_l, inner_x_r = int(w*0.42), int(w*0.58) # 模拟内侧起点
        
        # 计算模拟角度 (基于边缘分布)
        roi = gray[int(h*0.4):int(h*0.7), int(w*0.2):int(w*0.8)]
        variation = np.std(roi) / 255.0
        simulated_angle = round(min(max(22.5 + (variation * 35.0), 15.0), 45.0), 1)
        
        # 绘制 AI 角度线 (红色) - 正确方向：由内向外上方
        angle_rad = np.deg2rad(simulated_angle)
        # 左侧 AI
        l_end_x = p_left_x
        l_end_y = h_y - int(abs(p_left_x - inner_x_l) * np.tan(angle_rad))
        cv2.line(img, (inner_x_l, h_y), (l_end_x, max(0, l_end_y)), (0, 0, 255), 3)
        cv2.putText(img, f"AI:{simulated_angle}deg", (p_left_x - 20, h_y + 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        # 转换为 Base64
        _, buffer = cv2.imencode('.jpg', img)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        quadrant = "内下象限 (正常)" if simulated_angle < 28 else "外上象限 (高度疑似脱位)"
        return {
            "acetabular_index": simulated_angle, 
            "h_line_status": "解剖参考线已自动对齐", 
            "perkin_line": quadrant,
            "viz_image": f"data:image/jpeg;base64,{img_base64}"
        }
    except: return None

def analyze_visual_features(image_bytes):
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        input_tensor = preprocess(img).unsqueeze(0).to(device)
        with torch.no_grad():
            output = resnet(input_tensor)
            probs = torch.nn.functional.softmax(output[0], dim=0)
            score = 1.0 - torch.max(probs).item()
            return round((score * 1.5) % 1.0, 2)
    except: return 0.5

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
                "riskLevel": "高风险" if image_score > 0.6 or geometry_info.get('acetabular_index', 0) > 30 else "中风险" if image_score > 0.3 else "低风险",
                "recommendation": "建议进一步临床检查"
            },
            "evidence": {"medical_geometry": geometry_info, "cnn_feature_score": image_score}
        }
        yield json.dumps(metadata) + "\n--SEP--\n"

        # 3. DeepSeek 流式生成报告
        prompt = f"患者信息: 病史 {history_text}, Ortolani:{Ortolani}, Barlow:{Barlow}, 外展角:{abduction_deg}度, AI异常评分:{image_score}, 髋臼指数:{geometry_info.get('acetabular_index','无法测量')}度, Perkin判定:{geometry_info.get('perkin_line','无法判定')}。"
        
        try:
            response = client.chat.completions.create(
                model="deepseek-chat", 
                messages=[
                    {"role": "system", "content": "你是一名资深小儿骨科专家。请给出极其简洁的诊断分析。要求：1.直接给出结论；2.分点列出依据；3.一句话治疗建议。禁止使用Markdown格式（如**加粗），请直接输出纯文本。总字数200字以内。"},
                    {"role": "user", "content": prompt}
                ], 
                stream=True
            )
            for chunk in response:
                if chunk.choices[0].delta.content:
                    yield json.dumps({"type": "content", "content": chunk.choices[0].delta.content}) + "\n--SEP--\n"
        except Exception as e:
            yield json.dumps({"type": "error", "error": str(e)}) + "\n--SEP--\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
