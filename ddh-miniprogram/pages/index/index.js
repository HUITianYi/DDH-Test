const app = getApp()
const { buildLoginUrl, getCurrentUser, setCurrentUser } = require("../../utils/auth")

function fmtTime(d) {
  const pad = (n) => String(n).padStart(2, "0")
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds())
  )
}

Page({
  data: {
    useMock: true,
    useCloudFunction: false,
    user: null,
    baseUrl: "",
    backendStatusText: "未检测",
    backendStatusClass: "status-unknown",
    backendLatencyMs: null,
    backendCheckedAt: "",
    checkingBackend: false
  },
  onShow() {
    const gd = app.globalData || {}
    const user = getCurrentUser()
    this.setData({
      useMock: !!gd.useMock,
      useCloudFunction: !!gd.useCloudFunction,
      user: user && user.userId ? user : null,
      baseUrl: (gd.baseUrl || "").replace(/\/$/, "")
    })
    this.checkBackend()
  },
  goNewCase() {
    wx.navigateTo({ url: "/pages/case/case" })
  },
  goHistory() {
    const user = getCurrentUser()
    if (!user || !user.userId) {
      wx.navigateTo({ url: buildLoginUrl("/pages/history/history") })
      return
    }
    wx.navigateTo({ url: "/pages/history/history" })
  },
  goLogin() {
    wx.navigateTo({ url: buildLoginUrl("") })
  },
  logout() {
    setCurrentUser(null)
    wx.removeStorageSync("latestReport")
    this.setData({ user: null })
  },
  toggleMock() {
    const gd = app.globalData || {}
    gd.useMock = !gd.useMock
    app.globalData = gd
    this.setData({ useMock: !!gd.useMock })
  },
  checkBackend() {
    const gd = app.globalData || {}
    const baseUrl = (gd.baseUrl || "").replace(/\/$/, "")
    if (!baseUrl) {
      this.setData({
        backendStatusText: "未配置",
        backendStatusClass: "status-bad",
        backendLatencyMs: null,
        backendCheckedAt: fmtTime(new Date())
      })
      return
    }
    const start = Date.now()
    this.setData({ checkingBackend: true })
    wx.request({
      url: baseUrl + "/openapi.json",
      method: "GET",
      timeout: 8000,
      success: (res) => {
        const ok = res.statusCode >= 200 && res.statusCode < 300
        this.setData({
          backendStatusText: ok ? "可用" : "异常",
          backendStatusClass: ok ? "status-ok" : "status-bad",
          backendLatencyMs: Date.now() - start,
          backendCheckedAt: fmtTime(new Date())
        })
      },
      fail: () => {
        this.setData({
          backendStatusText: "不可达",
          backendStatusClass: "status-bad",
          backendLatencyMs: Date.now() - start,
          backendCheckedAt: fmtTime(new Date())
        })
      },
      complete: () => {
        this.setData({ checkingBackend: false })
      }
    })
  }
})
