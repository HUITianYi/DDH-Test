function getAppConfig() {
  const app = getApp()
  return app && app.globalData ? app.globalData : {}
}

function getCurrentUser() {
  const app = getApp()
  const inMemory = app && app.globalData ? app.globalData.currentUser : null
  if (inMemory && inMemory.userId) return inMemory
  const cached = wx.getStorageSync("currentUser")
  return cached && cached.userId ? cached : null
}

function setCurrentUser(user) {
  const app = getApp()
  if (app && app.globalData) {
    app.globalData.currentUser = user
  }
  if (user && user.userId) {
    wx.setStorageSync("currentUser", user)
    return
  }
  wx.removeStorageSync("currentUser")
}

function buildLoginUrl(redirect) {
  if (!redirect) {
    return "/pages/login/login"
  }
  return "/pages/login/login?redirect=" + encodeURIComponent(redirect)
}

async function loginWithWechat() {
  const loginRes = await new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject
    })
  })
  if (!loginRes || !loginRes.code) {
    throw new Error("WX_LOGIN_FAILED")
  }

  const config = getAppConfig()
  const nickname = "微信用户"
  const user = {
    userId: "wx-" + loginRes.code.slice(0, 12),
    openid: "local-" + loginRes.code,
    nickname,
    serverBaseUrl: config.baseUrl || ""
  }
  setCurrentUser(user)
  return user
}

module.exports = {
  buildLoginUrl,
  getCurrentUser,
  setCurrentUser,
  loginWithWechat
}
