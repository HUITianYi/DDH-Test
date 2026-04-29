function getAppConfig() {
  const app = getApp()
  return app && app.globalData ? app.globalData : { useCloudFunction: false, useMock: true }
}

function uploadDiagnose({ url, formData, filePath }) {
  return new Promise((resolve, reject) => {
    const requestConfig = {
      url,
      name: "file",
      formData,
      timeout: 60000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || "")
          return
        }
        reject(new Error("HTTP_" + res.statusCode))
      },
      fail: (err) => reject(err)
    }

    if (filePath) {
      requestConfig.filePath = filePath
      wx.uploadFile(requestConfig)
      return
    }

    delete requestConfig.name
    wx.request({
      url,
      method: "POST",
      header: { "content-type": "application/x-www-form-urlencoded" },
      data: formData,
      timeout: 60000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(typeof res.data === "string" ? res.data : JSON.stringify(res.data))
          return
        }
        reject(new Error("HTTP_" + res.statusCode))
      },
      fail: (err) => reject(err)
    })
  })
}

function parseDiagnoseStream(rawText) {
  const chunks = String(rawText || "")
    .split("\n--SEP--\n")
    .map((s) => s.trim())
    .filter(Boolean)

  const parsed = []
  chunks.forEach((c) => {
    try {
      const obj = JSON.parse(c)
      if (obj && typeof obj === "object") {
        parsed.push(obj)
      }
    } catch (e) { }
  })
  return parsed
}

function normalizeReportFromStream({ inputText, streamItems }) {
  const metadata = streamItems.find((it) => it.type === "metadata") || {}
  const content = streamItems
    .filter((it) => it.type === "content" && typeof it.content === "string")
    .map((it) => it.content)
    .join("")
    .trim()
  const error = streamItems.find((it) => it.type === "error")

  const geometry = (metadata.evidence && metadata.evidence.medical_geometry) || {}
  const score = metadata.evidence && metadata.evidence.cnn_feature_score
  const riskLevel = (metadata.output && metadata.output.riskLevel) || (error ? "错误" : "待医生确认")
  const recommendation = (metadata.output && metadata.output.recommendation) || "建议到医院专科进一步评估。"

  const evidence = []
  if (typeof score === "number") {
    evidence.push("视觉特征风险分值: " + score)
  }
  if (geometry && Object.keys(geometry).length > 0) {
    const ai = geometry.acetabular_index
    const perkin = geometry.perkin_line
    if (typeof ai !== "undefined") evidence.push("髋臼指数: " + ai)
    if (perkin) evidence.push("Perkin判定: " + perkin)
  }
  if (evidence.length === 0) {
    evidence.push("暂无可用影像量化依据。")
  }

  const recommendations = [recommendation]
  const impression = error
    ? "大模型连接失败: " + (error.error || "")
    : (content || "未返回文本诊断内容，请重试。")

  return {
    reportId: "ds-" + Date.now(),
    createdAt: new Date().toISOString(),
    model: {
      provider: "deepseek",
      name: "deepseek-chat"
    },
    input: {
      text: (inputText || "").trim()
    },
    output: {
      impression,
      riskLevel,
      evidence,
      recommendations,
      disclaimer: "本结果为AI生成，仅供医生参考，不构成医疗诊断。"
    }
  }
}

function buildLocalMockReport({ inputText, imagePaths }) {
  const normalizedText = (inputText || "").trim()
  const hasImage = Array.isArray(imagePaths) && imagePaths.length > 0
  return {
    reportId: "mock-" + Date.now(),
    createdAt: new Date().toISOString(),
    model: {
      provider: "deepseek",
      name: "mock",
      version: "0"
    },
    input: {
      text: normalizedText,
      imagesCount: hasImage ? imagePaths.length : 0
    },
    output: {
      impression: "当前为离线Mock结果：用于打通小程序流程。",
      riskLevel: "待医生确认",
      evidence: [
        "未接入后端与真实模型时，先用Mock结果占位。",
        hasImage ? "已选择影像文件（本地路径），待后端接入后上传分析。" : "未选择影像文件。"
      ],
      recommendations: [
        "请到医院骨科/儿保专科进一步评估。",
        "后续接入影像模型后，将根据影像自动生成结构化报告。"
      ],
      disclaimer: "本结果仅用于演示与流程打通，不构成医疗诊断。"
    }
  }
}

async function analyzeWithDeepSeek({ inputText, imagePaths, userId }) {
  const config = getAppConfig()

  if (config.useMock) {
    return buildLocalMockReport({ inputText, imagePaths })
  }

  const baseUrl = config.baseUrl || ""
  if (!baseUrl) {
    throw new Error("MISSING_BASE_URL")
  }
  const url = baseUrl.replace(/\/$/, "") + "/diagnose"
  const formData = {
    history_text: inputText || "",
    Ortolani: "neg",
    Barlow: "neg",
    abduction_deg: "0",
    user_id: userId || ""
  }

  const filePath = Array.isArray(imagePaths) && imagePaths.length > 0 ? imagePaths[0] : ""
  const rawText = await uploadDiagnose({
    url,
    formData,
    filePath
  })
  const streamItems = parseDiagnoseStream(rawText)
  return normalizeReportFromStream({ inputText, streamItems })
}

module.exports = {
  analyzeWithDeepSeek
}
