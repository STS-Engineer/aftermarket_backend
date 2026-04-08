const fourMValidationService = require('../services/fourMValidation.service')
const { verifyFourMAccessToken } = require('../emailService/ssr.mailer')

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

const normalizeFourMField = (okValue, explanation, dueDate, label, missing) => {
  const ok = parseBoolean(okValue)

  if (!ok) {
    if (!explanation || !String(explanation).trim()) {
      missing.push(`${label}Explanation`)
    }

    if (!dueDate) {
      missing.push(`${label}DueDate`)
    }
  }

  return {
    ok,
    explanation: ok ? null : String(explanation || '').trim(),
    dueDate: ok ? null : dueDate,
  }
}

const buildValidationPayload = (body) => {
  const {
    ssrId,
    productionCapacityPerWeek,
    machineOk,
    machineExplanation,
    machineDueDate,
    methodOk,
    methodExplanation,
    methodDueDate,
    laborOk,
    laborExplanation,
    laborDueDate,
    environmentOk,
    environmentExplanation,
    environmentDueDate,
  } = body

  const missing = []

  if (!ssrId) missing.push('ssrId')
  if (!productionCapacityPerWeek) missing.push('productionCapacityPerWeek')

  const machine = normalizeFourMField(machineOk, machineExplanation, machineDueDate, 'machine', missing)
  const method = normalizeFourMField(methodOk, methodExplanation, methodDueDate, 'method', missing)
  const labor = normalizeFourMField(laborOk, laborExplanation, laborDueDate, 'labor', missing)
  const environment = normalizeFourMField(environmentOk, environmentExplanation, environmentDueDate, 'environment', missing)

  return {
    missing,
    payload: {
      ssrId: Number(ssrId),
      productionCapacityPerWeek: Number(productionCapacityPerWeek),
      machineOk: machine.ok,
      machineExplanation: machine.explanation,
      machineDueDate: machine.dueDate,
      methodOk: method.ok,
      methodExplanation: method.explanation,
      methodDueDate: method.dueDate,
      laborOk: labor.ok,
      laborExplanation: labor.explanation,
      laborDueDate: labor.dueDate,
      environmentOk: environment.ok,
      environmentExplanation: environment.explanation,
      environmentDueDate: environment.dueDate,
    },
  }
}

const handleServiceError = (res, error, logPrefix) => {
  console.error(logPrefix, error)

  let status = 500
  if (error.message === 'SmallSerialRequest not found') status = 404
  if (error.message === '4M validation not found') status = 404
  if (error.message === 'document is required') status = 400

  return res.status(status).json({ message: error.message || 'Internal server error' })
}

const createFourMValidation = async (req, res) => {
  try {
    const { missing, payload } = buildValidationPayload(req.body)

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`
      })
    }

    if (Number(payload.productionCapacityPerWeek) < 1) {
      return res.status(400).json({ message: 'productionCapacityPerWeek must be at least 1' })
    }

    const data = await fourMValidationService.saveFourMValidation(payload, req.file)
    return res.status(201).json(data)
  } catch (error) {
    return handleServiceError(res, error, 'createFourMValidation error:')
  }
}

const getFourMValidationBySsrId = async (req, res) => {
  try {
    const data = await fourMValidationService.getFourMValidationBySsrId(req.params.ssrId)
    return res.status(200).json(data)
  } catch (error) {
    return handleServiceError(res, error, 'getFourMValidationBySsrId error:')
  }
}

const getSmallSerialRequestForFourMByToken = async (req, res) => {
  try {
    const payload = verifyFourMAccessToken(req.params.token)

    if (payload.purpose !== 'four_m_validation_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    const data = await fourMValidationService.getFourMAccessDataBySsrId(payload.ssrId)
    return res.status(200).json(data)
  } catch (error) {
    console.error('getSmallSerialRequestForFourMByToken error:', error)
    const status = error.message === 'SmallSerialRequest not found' ? 404 : 401
    return res.status(status).json({ message: error.message || 'Invalid or expired access token' })
  }
}

const createFourMValidationByToken = async (req, res) => {
  try {
    const accessPayload = verifyFourMAccessToken(req.params.token)

    if (accessPayload.purpose !== 'four_m_validation_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    req.body.ssrId = accessPayload.ssrId
    return await createFourMValidation(req, res)
  } catch (error) {
    console.error('createFourMValidationByToken error:', error)
    return res.status(401).json({ message: error.message || 'Invalid or expired access token' })
  }
}

module.exports = {
  createFourMValidation,
  getFourMValidationBySsrId,
  getSmallSerialRequestForFourMByToken,
  createFourMValidationByToken,
}
