const { requestJson } = require("./api")

function getAppConfig() {
  const app = getApp()
  return app && app.globalData ? app.globalData : { useMock: true }
}

function uploadFile({ url, filePath, name, formData, header }) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url,
      filePath,
      name: name || "file",
      formData: formData || {},
      header: header || {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data))
          } catch (e) {
            resolve(res.data)
          }
          return
        }
        reject({
          message: "UPLOAD_HTTP_ERROR",
          statusCode: res.statusCode,
          data: res.data
        })
      },
      fail: (err) => reject(err)
    })
  })
}

async function uploadImages({ imagePaths }) {
  const config = getAppConfig()

  if (config.useMock) {
    return (imagePaths || []).map((p) => ({
      key: p,
      origin: "local"
    }))
  }

  const baseUrl = (config.baseUrl || "").replace(/\/$/, "")
  if (!baseUrl) {
    throw new Error("MISSING_BASE_URL")
  }

  const uploaded = []
  for (const path of imagePaths || []) {
    const presign = await requestJson({
      url: baseUrl + "/api/files/presign",
      method: "POST",
      data: { purpose: "ddh_xray", filename: path.split("/").pop() || "image.jpg" }
    })

    if (presign && presign.uploadUrl && presign.fileKey) {
      await uploadFile({
        url: presign.uploadUrl,
        filePath: path,
        name: presign.name || "file",
        formData: presign.formData || {},
        header: presign.header || {}
      })
      uploaded.push({ key: presign.fileKey, origin: "storage" })
      continue
    }

    if (presign && presign.directUploadUrl) {
      const direct = await uploadFile({
        url: presign.directUploadUrl,
        filePath: path,
        name: presign.name || "file",
        formData: presign.formData || {},
        header: presign.header || {}
      })
      if (direct && direct.fileKey) {
        uploaded.push({ key: direct.fileKey, origin: "storage" })
        continue
      }
    }

    throw new Error("UPLOAD_NOT_CONFIGURED")
  }

  return uploaded
}

module.exports = {
  uploadImages
}

