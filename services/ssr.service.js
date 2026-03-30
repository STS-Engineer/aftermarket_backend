const SmallSerialRequest = require('../models/ssr.model')
const FourMValidation = require('../models/fourMValidation.model')
const STSForm = require('../models/stsForm.model')
const ProductInventoryValidation = require('../models/productInventoryValidation.model')
const RMAvailabilityValidation = require('../models/rmAvailabilityValidation.model')
const { getSalesRepById } = require('./salesService')
const path = require('path')

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
  const { kamId, fourMValidation, stsForm, productInventoryValidation, rmAvailabilityValidation, ...rest } = plainRequest

  return {
    ...rest,
    kam_id: kamId,
    kam,
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
  createSmallSerialRequest,
  getAllSmallSerialRequests,
  getSmallSerialRequestById,
  updateSmallSerialRequest,
  deleteSmallSerialRequest,
}
