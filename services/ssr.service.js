const SmallSerialRequest = require('../models/ssr.model')
const FourMValidation = require('../models/fourMValidation.model')
const STSForm = require('../models/stsForm.model')
const ProductInventoryValidation = require('../models/productInventoryValidation.model')
const RMAvailabilityValidation = require('../models/rmAvailabilityValidation.model')
const RawMaterial = require('../models/rawMaterial.model')
const { getSalesRepById } = require('./salesService')
const path = require('path')
const { getSalesRepDisplayName } = require('../utils/salesRep')

const normalizeNullableString = (value) => {
  if (value === undefined || value === null) return null

  const normalized = String(value).trim()
  return normalized ? normalized : null
}

const pickFirstDefined = (source, keys) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source || {}, key)) continue

    const value = source[key]
    if (value !== undefined) return value
  }

  return undefined
}

const normalizeNeedStudyCase = (value) => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1

  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return null
  if (['yes', 'true', '1', 'oui'].includes(normalized)) return true
  if (['no', 'false', '0', 'non'].includes(normalized)) return false

  return null
}

const normalizeRawMaterialStatus = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1

  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return defaultValue
  if (['true', '1', 'yes', 'oui'].includes(normalized)) return true
  if (['false', '0', 'no', 'non'].includes(normalized)) return false

  return defaultValue
}

const toPlainObject = (value) => (value?.get ? value.get({ plain: true }) : value)

const formatSavedRawMaterialRow = (row) => {
  const plainRow = toPlainObject(row) || {}
  const lastSellingPrice = normalizeNullableString(
    pickFirstDefined(plainRow, ['lastSellingPrice', 'last_selling_price', 'lastPurchasePrice', 'last_purchase_price'])
  ) || ''
  const lastSellingDate = normalizeNullableString(
    pickFirstDefined(plainRow, ['lastSellingDate', 'last_selling_date', 'lastPurchasingDate', 'last_purchasing_date'])
  ) || ''

  return {
    id: plainRow.id || null,
    ssrId: plainRow.ssrId || plainRow.ssr_id || null,
    orderIndex: Number.isInteger(plainRow.orderIndex) ? plainRow.orderIndex : Number(plainRow.orderIndex ?? plainRow.order_index ?? 0) || 0,
    partReference: normalizeNullableString(pickFirstDefined(plainRow, ['partReference', 'part_reference'])) || '',
    referenceDesignation: normalizeNullableString(pickFirstDefined(plainRow, ['referenceDesignation', 'reference_designation'])) || '',
    quantityPerUnit: normalizeNullableString(pickFirstDefined(plainRow, ['quantityPerUnit', 'quantity_per_unit'])) || '',
    totalRequirement: normalizeNullableString(pickFirstDefined(plainRow, ['totalRequirement', 'total_requirement'])) || '',
    inventoryDateRm: normalizeNullableString(pickFirstDefined(plainRow, ['inventoryDateRm', 'inventory_date_rm'])) || '',
    rmCurrentStock: normalizeNullableString(pickFirstDefined(plainRow, ['rmCurrentStock', 'rm_current_stock'])) || '',
    rmAvailableForProd: normalizeNullableString(pickFirstDefined(plainRow, ['rmAvailableForProd', 'rm_available_for_prod'])) || '',
    totalNeeds: normalizeNullableString(pickFirstDefined(plainRow, ['totalNeeds', 'total_needs'])) || '',
    lastPurchasePrice: lastSellingPrice,
    lastPurchasingDate: lastSellingDate,
    lastSellingPrice,
    lastSellingDate,
    status: normalizeRawMaterialStatus(pickFirstDefined(plainRow, ['status']), true),
    needStudyCase: normalizeNeedStudyCase(pickFirstDefined(plainRow, ['needStudyCase', 'need_study_case'])),
  }
}

const buildRawMaterialRecordsForStorage = (rawMaterials = []) => {
  if (!Array.isArray(rawMaterials)) return []

  return rawMaterials.map((row, index) => {
    const plainRow = toPlainObject(row) || {}
    const lastSellingPrice = normalizeNullableString(
      pickFirstDefined(plainRow, ['lastSellingPrice', 'last_selling_price', 'lastPurchasePrice', 'last_purchase_price'])
    )
    const lastSellingDate = normalizeNullableString(
      pickFirstDefined(plainRow, ['lastSellingDate', 'last_selling_date', 'lastPurchasingDate', 'last_purchasing_date'])
    )

    return {
      orderIndex: index,
      partReference: normalizeNullableString(pickFirstDefined(plainRow, ['partReference', 'part_reference'])),
      referenceDesignation: normalizeNullableString(pickFirstDefined(plainRow, ['referenceDesignation', 'reference_designation'])),
      quantityPerUnit: normalizeNullableString(pickFirstDefined(plainRow, ['quantityPerUnit', 'quantity_per_unit'])),
      totalRequirement: normalizeNullableString(pickFirstDefined(plainRow, ['totalRequirement', 'total_requirement'])),
      inventoryDateRm: normalizeNullableString(pickFirstDefined(plainRow, ['inventoryDateRm', 'inventory_date_rm'])),
      rmCurrentStock: normalizeNullableString(pickFirstDefined(plainRow, ['rmCurrentStock', 'rm_current_stock'])),
      rmAvailableForProd: normalizeNullableString(pickFirstDefined(plainRow, ['rmAvailableForProd', 'rm_available_for_prod'])),
      totalNeeds: normalizeNullableString(pickFirstDefined(plainRow, ['totalNeeds', 'total_needs'])),
      lastSellingPrice,
      lastSellingDate,
      status: normalizeRawMaterialStatus(pickFirstDefined(plainRow, ['status']), true),
      needStudyCase: normalizeNeedStudyCase(pickFirstDefined(plainRow, ['needStudyCase', 'need_study_case'])),
    }
  })
}

const getBaseRawMaterials = (ssr) => {
  if (Array.isArray(ssr?.rawMaterials)) return ssr.rawMaterials
  if (Array.isArray(ssr?.stsForm?.rawMaterials)) return ssr.stsForm.rawMaterials
  return []
}

const mergeRMAvailabilityRawMaterials = (baseRows = [], savedRows = []) => {
  const normalizedBaseRows = Array.isArray(baseRows)
    ? baseRows.map((row) => ({ ...(toPlainObject(row) || {}) }))
    : []
  const remainingSavedRows = (Array.isArray(savedRows) ? savedRows : [])
    .map(formatSavedRawMaterialRow)

  if (normalizedBaseRows.length === 0) {
    return remainingSavedRows.filter((row) => row.status !== false)
  }

  const takeMatchingSavedRow = (baseRow, index) => {
    const basePartReference = normalizeNullableString(baseRow?.partReference ?? baseRow?.part_reference)
    let matchIndex = -1

    if (basePartReference) {
      matchIndex = remainingSavedRows.findIndex((savedRow) => (
        normalizeNullableString(savedRow.partReference) === basePartReference
        && savedRow.orderIndex === index
      ))

      if (matchIndex === -1) {
        matchIndex = remainingSavedRows.findIndex((savedRow) => (
          normalizeNullableString(savedRow.partReference) === basePartReference
        ))
      }
    }

    if (matchIndex === -1) {
      matchIndex = remainingSavedRows.findIndex((savedRow) => savedRow.orderIndex === index)
    }

    if (matchIndex === -1) return null
    return remainingSavedRows.splice(matchIndex, 1)[0]
  }

  const mergedRows = normalizedBaseRows.flatMap((baseRow, index) => {
    const savedRow = takeMatchingSavedRow(baseRow, index)
    if (savedRow?.status === false) {
      return []
    }

    return [savedRow ? { ...baseRow, ...savedRow } : baseRow]
  })

  return [...mergedRows, ...remainingSavedRows.filter((row) => row.status !== false)]
}

const mapPayloadToModel = (data) => {
  const payload = { ...data }

  if (Object.prototype.hasOwnProperty.call(payload, 'kam_id')) {
    payload.kamId = payload.kam_id
    delete payload.kam_id
  }

  return payload
}

const formatFourMValidationForFrontend = (validation) => {
  if (!validation) return null

  const { documentData, ...rest } = validation
  let documentPath = null

  if (documentData) {
    documentPath = Buffer.isBuffer(documentData)
      ? documentData.toString('utf8')
      : String(documentData)
  }

  return {
    ...rest,
    documentPath,
    hasDocument: !!documentPath,
  }
}

const formatStsFormForFrontend = (form) => {
  if (!form) return null

  return form
}

const formatProductInventoryValidationForFrontend = (validation) => {
  if (!validation) return null

  const { approvalDocumentData, ...rest } = validation
  let approvalDocumentPath = null

  if (approvalDocumentData) {
    approvalDocumentPath = Buffer.isBuffer(approvalDocumentData)
      ? approvalDocumentData.toString('utf8')
      : String(approvalDocumentData)
  }

  return {
    ...rest,
    approvalDocumentPath,
    hasApprovalDocument: !!approvalDocumentPath,
  }
}

const formatRMAvailabilityValidationForFrontend = (validation) => {
  if (!validation) return null

  const { approvalDocumentData, ...rest } = validation
  let approvalDocumentPath = null

  if (approvalDocumentData) {
    approvalDocumentPath = Buffer.isBuffer(approvalDocumentData)
      ? approvalDocumentData.toString('utf8')
      : String(approvalDocumentData)
  }

  return {
    ...rest,
    approvalDocumentPath,
    approvalDocumentName: rest.approvalDocumentName || (approvalDocumentPath ? path.basename(approvalDocumentPath) : null),
    hasApprovalDocument: !!approvalDocumentPath,
  }
}

const formatRequestForFrontend = (request, kam = null) => {
  const plainRequest = request.get({ plain: true })
  const {
    kamId,
    fourMValidation,
    stsForm,
    productInventoryValidation,
    rmAvailabilityValidation,
    rmAvailabilityRawMaterials,
    ...rest
  } = plainRequest
  const mergedRawMaterials = mergeRMAvailabilityRawMaterials(
    getBaseRawMaterials({ stsForm, rawMaterials: rest.rawMaterials }),
    rmAvailabilityRawMaterials
  )

  return {
    ...rest,
    kam_id: kamId,
    kam,
    kamName: getSalesRepDisplayName(kam) || null,
    rawMaterials: mergedRawMaterials,
    fourMValidation: formatFourMValidationForFrontend(fourMValidation),
    stsForm: formatStsFormForFrontend(stsForm),
    productInventoryValidation: formatProductInventoryValidationForFrontend(productInventoryValidation),
    rmAvailabilityValidation: formatRMAvailabilityValidationForFrontend(rmAvailabilityValidation),
  }
}

const attachKamToRequest = async (request) => {
  let kam = null

  try {
    kam = await getSalesRepById(request.kamId)
  } catch (error) {
    if (error.message !== 'Sales rep not found') {
      throw error
    }
  }

  return formatRequestForFrontend(request, kam)
}

const getIncludes = () => ([
  { model: FourMValidation, as: 'fourMValidation', required: false },
  { model: STSForm, as: 'stsForm', required: false },
  { model: ProductInventoryValidation, as: 'productInventoryValidation', required: false },
  { model: RMAvailabilityValidation, as: 'rmAvailabilityValidation', required: false },
  { model: RawMaterial, as: 'rmAvailabilityRawMaterials', required: false, separate: true, order: [['orderIndex', 'ASC']] },
])

const createSmallSerialRequest = async (data) => {
  const request = await SmallSerialRequest.create(mapPayloadToModel(data))
  const requestWithRelations = await SmallSerialRequest.findByPk(request.id, {
    include: getIncludes(),
  })
  const formattedRequest = await attachKamToRequest(requestWithRelations)

  try {
    const { sendNewSmallSerialRequestEmails } = require('../emailService/ssr.mailer')
    await sendNewSmallSerialRequestEmails({ ssr: formattedRequest })
  } catch (error) {
    console.error('sendNewSmallSerialRequestEmails error:', error)
  }

  return formattedRequest
}

const getAllSmallSerialRequests = async () => {
  const requests = await SmallSerialRequest.findAll({
    include: getIncludes(),
    order: [['createdAt', 'DESC']],
  })

  return await Promise.all(requests.map(attachKamToRequest))
}

const getSmallSerialRequestById = async (id) => {
  const request = await SmallSerialRequest.findByPk(id, {
    include: getIncludes(),
  })
  if (!request) throw new Error('SmallSerialRequest not found')
  return await attachKamToRequest(request)
}

const updateSmallSerialRequest = async (id, data) => {
  const request = await SmallSerialRequest.findByPk(id)
  if (!request) throw new Error('SmallSerialRequest not found')
  await request.update(mapPayloadToModel(data))

  const updatedRequest = await SmallSerialRequest.findByPk(id, {
    include: getIncludes(),
  })

  return await attachKamToRequest(updatedRequest)
}

const deleteSmallSerialRequest = async (id) => {
  const request = await SmallSerialRequest.findByPk(id)
  if (!request) throw new Error('SmallSerialRequest not found')
  await request.destroy()
  return { message: 'SmallSerialRequest deleted successfully' }
}

module.exports = {
  normalizeNullableString,
  buildRawMaterialRecordsForStorage,
  getBaseRawMaterials,
  mergeRMAvailabilityRawMaterials,
  createSmallSerialRequest,
  getAllSmallSerialRequests,
  getSmallSerialRequestById,
  updateSmallSerialRequest,
  deleteSmallSerialRequest,
}
