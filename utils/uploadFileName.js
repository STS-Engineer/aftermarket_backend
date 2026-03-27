const path = require('path')

const normalizeUploadedFileName = (fileName) => {
  if (!fileName) return 'document'

  try {
    return Buffer.from(fileName, 'latin1').toString('utf8')
  } catch (error) {
    return fileName
  }
}

const buildStoredUploadFileName = (fileName) => {
  const normalizedName = normalizeUploadedFileName(fileName)
  const ext = path.extname(normalizedName)
  const baseName = path.basename(normalizedName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 80) || 'document'

  return `${Date.now()}-${baseName}${ext}`
}

module.exports = {
  normalizeUploadedFileName,
  buildStoredUploadFileName,
}
