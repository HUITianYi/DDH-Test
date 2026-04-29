const { analyzeWithDeepSeek } = require("../../utils/deepseek")
const { getCurrentUser } = require("../../utils/auth")

Page({
  data: {
    inputText: "",
    images: [],
    loading: false
  },
  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },
  chooseImage() {
    wx.chooseImage({
      count: 9,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const paths = (res.tempFilePaths || []).slice(0, 9)
        this.setData({ images: paths })
      }
    })
  },
  previewImage(e) {
    const src = e.currentTarget.dataset.src
    wx.previewImage({
      current: src,
      urls: this.data.images || []
    })
  },
  async submit() {
    const user = getCurrentUser()
    const inputText = (this.data.inputText || "").trim()
    if (!inputText && (!this.data.images || this.data.images.length === 0)) {
      wx.showToast({ title: "请先输入文字或选择图片", icon: "none" })
      return
    }

    this.setData({ loading: true })
    try {
      const report = await analyzeWithDeepSeek({
        inputText,
        imagePaths: this.data.images || [],
        userId: user && user.userId ? user.userId : ""
      })
      const history = wx.getStorageSync("reportsHistory") || []
      history.unshift(report)
      wx.setStorageSync("reportsHistory", history.slice(0, 200))
      wx.setStorageSync("latestReport", report)
      wx.navigateTo({ url: "/pages/report/report" })
    } catch (e) {
      wx.showModal({
        title: "生成失败",
        content: (e && e.message) || "请稍后重试",
        showCancel: false
      })
    } finally {
      this.setData({ loading: false })
    }
  },
  reset() {
    this.setData({ inputText: "", images: [] })
  }
})
