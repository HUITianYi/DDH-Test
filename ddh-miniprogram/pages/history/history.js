const { buildLoginUrl, getCurrentUser } = require("../../utils/auth")

function toRiskClass(riskLevel) {
  const text = String(riskLevel || "")
  if (text.includes("高")) return "high"
  if (text.includes("中")) return "medium"
  if (text.includes("低")) return "low"
  return "normal"
}

Page({
  data: {
    loading: false,
    list: []
  },
  onShow() {
    this.loadHistory()
  },
  async loadHistory() {
    const user = getCurrentUser()
    if (!user || !user.userId) {
      wx.redirectTo({ url: buildLoginUrl("/pages/history/history") })
      return
    }
    this.setData({ loading: true })
    try {
      const list = wx.getStorageSync("reportsHistory") || []
      const items = list.map((it) => ({
        reportId: it.reportId,
        createdAt: it.createdAt,
        riskLevel: (it.output && it.output.riskLevel) || "待医生确认",
        riskClass: toRiskClass(it.output && it.output.riskLevel),
        impression: (it.output && it.output.impression) || ""
      }))
      this.setData({ list: items })
    } catch (e) {
      wx.showToast({ title: "获取历史失败", icon: "none" })
    } finally {
      this.setData({ loading: false })
    }
  },
  openDetail(e) {
    const reportId = e.currentTarget.dataset.id
    if (!reportId) return
    wx.navigateTo({ url: "/pages/report/report?reportId=" + encodeURIComponent(reportId) })
  }
})
