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

const getFirstDefinedRawMaterialValue = (row, keys) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row || {}, key)) continue

    const value = row[key]

    if (value === undefined || value === null) continue
    if (typeof value === 'string') {
      if (value.trim()) return value
      continue
    }

    return value
  }

  return null
}

const getSpecificRMRawMaterialErrors = (rawMaterials = []) => {
  const requiredFields = [
    {
      label: 'Minimum Order Quantity',
      keys: ['minimumOrderQuantity', 'minimum_order_quantity', 'minimumOrderQty', 'moq'],
    },
    {
      label: 'X MOQ to Order',
      keys: ['xMoqToOrder', 'xMOQToOrder', 'x_moq_to_order', 'orderMultiplier', 'order_multiplier', 'multiplier'],
    },
    {
      label: 'Quantity Under Order',
      keys: ['quantityUnderOrder', 'quantity_under_order', 'orderedQuantity', 'ordered_quantity', 'qtyUnderOrder'],
    },
    {
      label: 'Lead time (week)',
      keys: ['leadTimeWeek', 'leadTimeWeeks', 'lead_time_week', 'leadTime', 'lead_time', 'leadTimeInWeek'],
    },
    {
      label: 'Supplier Price Proposal',
      keys: ['supplierPriceProposal', 'supplier_price_proposal', 'currentPurchasePrice', 'current_purchase_price'],
    },
  ]

  return rawMaterials.flatMap((row, index) => (
    requiredFields
      .filter((field) => getFirstDefinedRawMaterialValue(row, field.keys) === null)
      .map((field) => `Row ${index + 1}: ${field.label}`)
  ))
}

const buildPayload = (body) => {
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

const getSpecificRMStudyAccessByToken = async (req, res) => {
  try {
    const payload = verifyStsAccessToken(req.params.token)

    if (payload.purpose !== 'sts_form_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    const data = await stsFormService.getSpecificRMStudyAccessDataBySsrId(payload.ssrId)
    return res.status(200).json(data)
  } catch (error) {
    console.error('getSpecificRMStudyAccessByToken error:', error)
    const status = error.message === 'SmallSerialRequest not found' ? 404 : 401
    return res.status(status).json({ message: error.message || 'Invalid or expired access token' })
  }
}

const submitSpecificRMStudyFormByToken = async (req, res) => {
  try {
    const accessPayload = verifyStsAccessToken(req.params.token)

    if (accessPayload.purpose !== 'sts_form_access') {
      return res.status(400).json({ message: 'Invalid access token' })
    }

    req.body.ssrId = accessPayload.ssrId
    const { missing, payload } = buildPayload(req.body)

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`,
      })
    }

    const rawMaterialErrors = getSpecificRMRawMaterialErrors(payload.rawMaterials)

    if (rawMaterialErrors.length > 0) {
      return res.status(400).json({
        message: `Missing required raw material fields: ${rawMaterialErrors.join(', ')}`,
      })
    }

    const data = await stsFormService.saveSpecificRMStudyForm(payload)
    return res.status(201).json(data)
  } catch (error) {
    if (error.message === 'rawMaterials must be valid JSON') {
      return res.status(400).json({ message: error.message })
    }

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: error.message || 'Invalid or expired access token' })
    }

    return handleServiceError(res, error, 'submitSpecificRMStudyFormByToken error:')
  }
}

module.exports = {
  getSpecificRMStudyAccessByToken,
  submitSpecificRMStudyFormByToken,
}
