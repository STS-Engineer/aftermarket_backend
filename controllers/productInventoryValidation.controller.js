const productInventoryValidationService = require('../services/productInventoryValidation.service')
const { verifyStsAccessToken } = require('../emailService/ssr.mailer')

const buildValidationPayload = (body) => {
  const payload = {
    ssrId: body.ssrId ? Number(body.ssrId) : null,
    productAvailableForSale: body.productAvailableForSale ?? null,
  }

  const missing = []

  if (!payload.ssrId) missing.push('ssrId')
  if (!payload.productAvailableForSale || !String(payload.productAvailableForSale).trim()) {
    missing.push('productAvailableForSale')
  }

  return { missing, payload }
}

const handleServiceError = (res, error, logPrefix) => {
  console.error(logPrefix, error)

  let status = 500
  if (error.message === 'SmallSerialRequest not found') status = 404
  if (error.message === 'Product inventory validation not found') status = 404
  if (error.message === 'productAvailableForSale is required') status = 400
  if (error.message === 'approval document is required') status = 400

  return res.status(status).json({ message: error.message || 'Internal server error' })
}

const submitProductInventoryValidation = async (req, res) => {
  try {
    const { missing, payload } = buildValidationPayload(req.body)

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`,
      })
    }

    const data = await productInventoryValidationService.saveProductInventoryValidation(payload, req.file)
    return res.status(201).json(data)
  } catch (error) {
    return handleServiceError(res, error, 'submitProductInventoryValidation error:')
  }
}

const getProductInventoryValidationBySsrId = async (req, res) => {
  try {
    const data = await productInventoryValidationService.getProductInventoryValidationBySsrId(req.params.ssrId)
    return res.status(200).json(data)
  } catch (error) {
    return handleServiceError(res, error, 'getProductInventoryValidationBySsrId error:')
  }
}

const getProductInventoryAccessByToken = async (req, res) => {
  try {
    const payload = verifyStsAccessToken(req.params.token)

    if (payload.purpose !== 'sts_form_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    const data = await productInventoryValidationService.getProductInventoryAccessDataBySsrId(payload.ssrId)
    return res.status(200).json(data)
  } catch (error) {
    console.error('getProductInventoryAccessByToken error:', error)
    const status = error.message === 'SmallSerialRequest not found' ? 404 : 401
    return res.status(status).json({ message: error.message || 'Invalid or expired access token' })
  }
}

const submitProductInventoryValidationByToken = async (req, res) => {
  try {
    const accessPayload = verifyStsAccessToken(req.params.token)

    if (accessPayload.purpose !== 'sts_form_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    req.body.ssrId = accessPayload.ssrId
    return await submitProductInventoryValidation(req, res)
  } catch (error) {
    console.error('submitProductInventoryValidationByToken error:', error)
    return res.status(401).json({ message: error.message || 'Invalid or expired access token' })
  }
}

module.exports = {
  submitProductInventoryValidation,
  getProductInventoryValidationBySsrId,
  getProductInventoryAccessByToken,
  submitProductInventoryValidationByToken,
}
