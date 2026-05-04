const getFrontendBaseUrl = () => String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '')

const buildFrontendUrl = (pathname = '') => {
  const baseUrl = getFrontendBaseUrl()
  const normalizedPath = String(pathname || '').trim().replace(/^\/+/, '')

  if (!baseUrl) {
    throw new Error('FRONTEND_URL is not configured')
  }

  return normalizedPath ? `${baseUrl}/${normalizedPath}` : baseUrl
}

module.exports = {
  getFrontendBaseUrl,
  buildFrontendUrl,
}
