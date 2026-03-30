const rmAvailabilityValidationService = require('../services/rmAvailabilityValidation.service')
const { verifyStsAccessToken } = require('../emailService/ssr.mailer')

const buildValidationPayload = (body) => {
  const payload = {
    ssrId: body.ssrId ? Number(body.ssrId) : null,
  }

  const missing = []
  if (!payload.ssrId) missing.push('ssrId')

  return { missing, payload }
}

const handleServiceError = (res, error, logPrefix) => {
  console.error(logPrefix, error)

  let status = 500
  if (error.message === 'SmallSerialRequest not found') status = 404
  if (error.message === 'RM availability validation not found') status = 404
  if (error.message === 'approval document is required') status = 400

  return res.status(status).json({ message: error.message || 'Internal server error' })
}

const submitRMAvailabilityValidation = async (req, res) => {
  try {
    const { missing, payload } = buildValidationPayload(req.body)

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`,
      })
    }

    const data = await rmAvailabilityValidationService.saveRMAvailabilityValidation(payload, req.file)
    return res.status(201).json(data)
  } catch (error) {
    return handleServiceError(res, error, 'submitRMAvailabilityValidation error:')
  }
}

const getRMAvailabilityValidationBySsrId = async (req, res) => {
  try {
    const data = await rmAvailabilityValidationService.getRMAvailabilityValidationBySsrId(req.params.ssrId)
    return res.status(200).json(data)
  } catch (error) {
    return handleServiceError(res, error, 'getRMAvailabilityValidationBySsrId error:')
  }
}

const getRMAvailabilityAccessByToken = async (req, res) => {
  try {
    const payload = verifyStsAccessToken(req.params.token)

    if (payload.purpose !== 'sts_form_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    const data = await rmAvailabilityValidationService.getRMAvailabilityAccessDataBySsrId(payload.ssrId)
    return res.status(200).json(data)
  } catch (error) {
    console.error('getRMAvailabilityAccessByToken error:', error)
    const status = error.message === 'SmallSerialRequest not found' ? 404 : 401
    return res.status(status).json({ message: error.message || 'Invalid or expired access token' })
  }
}

const submitRMAvailabilityValidationByToken = async (req, res) => {
  try {
    const accessPayload = verifyStsAccessToken(req.params.token)

    if (accessPayload.purpose !== 'sts_form_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    req.body.ssrId = accessPayload.ssrId
    return await submitRMAvailabilityValidation(req, res)
  } catch (error) {
    console.error('submitRMAvailabilityValidationByToken error:', error)
    return res.status(401).json({ message: error.message || 'Invalid or expired access token' })
  }
}

module.exports = {
  submitRMAvailabilityValidation,
  getRMAvailabilityValidationBySsrId,
  getRMAvailabilityAccessByToken,
  submitRMAvailabilityValidationByToken,
}
