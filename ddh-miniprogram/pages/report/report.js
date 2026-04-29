const { buildLoginUrl, getCurrentUser } = require("../../utils/auth")

function tryParseOutputFromImpression(impression) {
  if (typeof impression !== "string") return null
  let text = impression.trim()
  if (!text) return null
  if (text.startsWith("```")) {
    const lines = text.split("\n")
    if (lines.length >= 2) {
      lines.shift()
      if (lines[lines.length - 1].trim() === "```") {
        lines.pop()
      }
      text = lines.join("\n").trim()
    }
  }
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch (e) { }
  const left = text.indexOf("{")
  const right = text.lastIndexOf("}")
  if (left !== -1 && right !== -1 && right > left) {
    try {
      const parsed = JSON.parse(text.slice(left, right + 1))
      return parsed && typeof parsed === "object" ? parsed : null
    } catch (e) { }
  }
  return null
}

function normalizeReport(report) {
  if (!report || !report.output) return report
  const output = Object.assign({}, report.output)
  const parsed = tryParseOutputFromImpression(output.impression)
  if (parsed) {
    output.impression = parsed.impression || output.impression || ""
    output.riskLevel = parsed.riskLevel || output.riskLevel || "待医生确认"
    output.evidence = Array.isArray(parsed.evidence) ? parsed.evidence : (output.evidence || [])
    output.recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : (output.recommendations || [])
    output.disclaimer = parsed.disclaimer || output.disclaimer || ""
  } else {
    output.evidence = Array.isArray(output.evidence) ? output.evidence : []
    output.recommendations = Array.isArray(output.recommendations) ? output.recommendations : []
  }
  return Object.assign({}, report, { output })
}

function splitParagraphs(text) {
  if (!text) return []
  const normalized = String(text).replace(/\r/g, "").trim()
  if (!normalized) return []
  const rough = normalized
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const list = []
  rough.forEach((line) => {
    const segments = line
      .split(/(?<=[。！？；;])/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (segments.length === 0) {
      list.push(line)
      return
    }
    segments.forEach((seg) => list.push(seg))
  })
  return list
}

function highlightTokens(text) {
  const keyword = /(高风险|中风险|低风险|阳性|阴性|异常|严重|建议|尽快|立即|复诊|转诊|急诊|警惕|重点)/g
  const keywordSingle = /^(高风险|中风险|低风险|阳性|阴性|异常|严重|建议|尽快|立即|复诊|转诊|急诊|警惕|重点)$/
  const parts = String(text || "").split(keyword).filter((v) => v !== "")
  return parts.map((p) => ({
    text: p,
    highlight: keywordSingle.test(p)
  }))
}

Page({
  data: {
    report: null,
    reportId: "",
    impressionParagraphs: []
  },
  onLoad(options) {
    this.setData({ reportId: (options && options.reportId) || "" })
  },
  async onShow() {
    const reportId = this.data.reportId
    if (reportId) {
      await this.loadReportById(reportId)
      return
    }
    const report = normalizeReport(wx.getStorageSync("latestReport") || null)
    this.applyReport(report)
  },
  applyReport(report) {
    const normalized = normalizeReport(report)
    const paragraphs = splitParagraphs((normalized && normalized.output && normalized.output.impression) || "").map((t) => ({
      parts: highlightTokens(t)
    }))
    this.setData({
      report: normalized,
      impressionParagraphs: paragraphs
    })
  },
  async loadReportById(reportId) {
    const user = getCurrentUser()
    if (!user || !user.userId) {
      wx.redirectTo({ url: buildLoginUrl("/pages/report/report?reportId=" + encodeURIComponent(reportId)) })
      return
    }
    try {
      const list = wx.getStorageSync("reportsHistory") || []
      const report = list.find((it) => it.reportId === reportId)
      if (!report) {
        wx.showToast({ title: "报告不存在", icon: "none" })
        return
      }
      wx.setStorageSync("latestReport", report)
      this.applyReport(report)
    } catch (e) {
      wx.showToast({ title: "加载报告失败", icon: "none" })
    }
  },
  goCreate() {
    wx.navigateTo({ url: "/pages/case/case" })
  }
})
