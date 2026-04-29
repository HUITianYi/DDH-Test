const { loginWithWechat, getCurrentUser } = require("../../utils/auth")

Page({
  data: {
    loading: false,
    redirect: "",
    needHistoryAccess: false
  },
  onLoad(options) {
    const redirect = options && options.redirect ? decodeURIComponent(options.redirect) : ""
    this.setData({
      redirect,
      needHistoryAccess: redirect.indexOf("/pages/history/history") === 0
    })
  },
  onShow() {
    const user = getCurrentUser()
    if (user && user.userId) {
      this.goNext()
    }
  },
  goNext() {
    const redirect = this.data.redirect || "/pages/index/index"
    if (this.data.redirect) {
      wx.redirectTo({ url: redirect })
      return
    }
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }
    wx.reLaunch({ url: redirect })
  },
  async onWxLogin() {
    this.setData({ loading: true })
    try {
      await loginWithWechat()
      this.goNext()
    } catch (e) {
      wx.showModal({
        title: "登录失败",
        content: (e && e.message) || "请检查后端地址与网络连接",
        showCancel: false
      })
    } finally {
      this.setData({ loading: false })
    }
  }
})
