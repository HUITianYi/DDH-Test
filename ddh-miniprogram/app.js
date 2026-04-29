App({
  globalData: {
    baseUrl: "https://api.ddh-ai.top",
    envId: "",
    useCloudFunction: false,
    useMock: false,
    currentUser: null
  },
  onLaunch() {
    const cachedUser = wx.getStorageSync("currentUser")
    if (cachedUser && cachedUser.userId) {
      this.globalData.currentUser = cachedUser
    }
    if (this.globalData.useCloudFunction) {
      try {
        wx.cloud.init({
          env: this.globalData.envId,
          traceUser: true
        })
      } catch (e) { }
    }
  }
})
