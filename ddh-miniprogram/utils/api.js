const DEFAULT_TIMEOUT_MS = 15000

function requestJson({ url, method, data, header, timeoutMs }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: method || "GET",
      data: data || {},
      header: Object.assign({ "content-type": "application/json" }, header || {}),
      timeout: timeoutMs || DEFAULT_TIMEOUT_MS,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        reject({
          message: "HTTP_ERROR",
          statusCode: res.statusCode,
          data: res.data
        })
      },
      fail: (err) => reject(err)
    })
  })
}

module.exports = {
  requestJson
}
