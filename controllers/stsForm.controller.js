const stsFormService = require('../services/stsForm.service')
const { verifyStsAccessToken } = require('../emailService/ssr.mailer')

const parseRawMaterials = (value) => {
  if (Array.isArray(value)) return value
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    throw new Error('rawMaterials must be valid JSON')
  }
}

const buildStsPayload = (body) => {
  const payload = {
    ssrId: body.ssrId ? Number(body.ssrId) : null,
    productCurrentStock: body.productCurrentStock ?? null,
    lastSellingPrice: body.lastSellingPrice ?? null,
    lastSellingDate: body.lastSellingDate || null,
    rawMaterials: parseRawMaterials(body.rawMaterials),
  }

  const missing = []

  if (!payload.ssrId) missing.push('ssrId')

  return { missing, payload }
}

const handleServiceError = (res, error, logPrefix) => {
  console.error(logPrefix, error)

  let status = 500
  if (error.message === 'SmallSerialRequest not found') status = 404
  if (error.message === 'STS form not found') status = 404
  if (error.message === 'rawMaterials must be valid JSON') status = 400

  return res.status(status).json({ message: error.message || 'Internal server error' })
}

const submitStsForm = async (req, res) => {
  try {
    const { missing, payload } = buildStsPayload(req.body)

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`,
      })
    }

    const data = await stsFormService.saveStsForm(payload)
    return res.status(201).json(data)
  } catch (error) {
    return handleServiceError(res, error, 'submitStsForm error:')
  }
}

const getStsFormBySsrId = async (req, res) => {
  try {
    const data = await stsFormService.getStsFormBySsrId(req.params.ssrId)
    return res.status(200).json(data)
  } catch (error) {
    return handleServiceError(res, error, 'getStsFormBySsrId error:')
  }
}

const getStsAccessByToken = async (req, res) => {
  try {
    const payload = verifyStsAccessToken(req.params.token)

    if (payload.purpose !== 'sts_form_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    const data = await stsFormService.getStsAccessDataBySsrId(payload.ssrId)
    return res.status(200).json(data)
  } catch (error) {
    console.error('getStsAccessByToken error:', error)
    const status = error.message === 'SmallSerialRequest not found' ? 404 : 401
    return res.status(status).json({ message: error.message || 'Invalid or expired access token' })
  }
}

const submitStsFormByToken = async (req, res) => {
  try {
    const accessPayload = verifyStsAccessToken(req.params.token)

    if (accessPayload.purpose !== 'sts_form_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    req.body.ssrId = accessPayload.ssrId
    return await submitStsForm(req, res)
  } catch (error) {
    console.error('submitStsFormByToken error:', error)
    return res.status(401).json({ message: error.message || 'Invalid or expired access token' })
  }
}

module.exports = {
  submitStsForm,
  getStsFormBySsrId,
  getStsAccessByToken,
  submitStsFormByToken,
}
