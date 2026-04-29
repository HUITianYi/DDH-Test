const https = require("https")
const { URL } = require("url")

function assertEnv(name) {
  const v = process.env[name]
  if (!v) {
    const err = new Error("MISSING_ENV_" + name)
    err.code = "MISSING_ENV"
    throw err
  }
  return v
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s)
  } catch (e) {
    return null
  }
}

async function callOpenAICompatible({ baseUrl, apiKey, model, messages }) {
  const endpoint = new URL(baseUrl.replace(/\/$/, "") + "/chat/completions")
  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.2
  })

  const text = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port || (endpoint.protocol === "https:" ? 443 : 80),
        path: endpoint.pathname + endpoint.search,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          authorization: "Bearer " + apiKey
        },
        timeout: 30000
      },
      (res) => {
        let buf = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          buf += chunk
        })
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(buf)
            return
          }
          const err = new Error("UPSTREAM_ERROR_" + (res.statusCode || "NO_STATUS"))
          err.status = res.statusCode || 0
          err.body = buf
          reject(err)
        })
      }
    )

    req.on("timeout", () => {
      req.destroy(new Error("UPSTREAM_TIMEOUT"))
    })
    req.on("error", reject)
    req.write(body)
    req.end()
  })

  const json = safeJsonParse(text)
  if (!json) {
    const err = new Error("UPSTREAM_NON_JSON")
    err.body = text
    throw err
  }
  return json
}

exports.main = async (event) => {
  const inputText = (event && event.inputText) || ""
  const imageKeys = (event && event.imageKeys) || []

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1"
  const apiKey = assertEnv("DEEPSEEK_API_KEY")
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat"

  const systemPrompt =
    "你是医疗辅助报告生成助手。请根据输入的文字信息生成结构化JSON报告，字段为：impression,riskLevel,evidence,recommendations,disclaimer。只输出JSON。"

  const userPayload = {
    text: inputText,
    imageKeys,
    note: "imageKeys仅为占位，当前版本不直接在云函数读取影像。"
  }

  const upstream = await callOpenAICompatible({
    baseUrl,
    apiKey,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPayload) }
    ]
  })

  const content =
    upstream &&
    upstream.choices &&
    upstream.choices[0] &&
    upstream.choices[0].message &&
    upstream.choices[0].message.content

  const parsed = safeJsonParse(content || "")

  return {
    reportId: "ds-" + Date.now(),
    createdAt: new Date().toISOString(),
    model: {
      provider: "deepseek",
      name: model,
      baseUrl
    },
    input: {
      text: inputText,
      imageKeysCount: Array.isArray(imageKeys) ? imageKeys.length : 0
    },
    output:
      parsed || {
        impression: content || "",
        riskLevel: "待医生确认",
        evidence: [],
        recommendations: [],
        disclaimer: "本结果为AI生成，仅供医生参考，不构成医疗诊断。"
      }
  }
}
