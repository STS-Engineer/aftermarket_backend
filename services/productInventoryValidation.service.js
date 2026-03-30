const ProductInventoryValidation = require('../models/productInventoryValidation.model')
const ssrService = require('./ssr.service')
const fs = require('fs')
const path = require('path')

const normalizeNullableString = (value) => {
  if (value === undefined || value === null) return null

  const normalized = String(value).trim()
  return normalized ? normalized : null
}

const toFiniteNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const deriveProductionToLaunch = ({ quantityRequested, productCurrentStock }) => {
  const quantity = toFiniteNumber(quantityRequested)
  const stock = toFiniteNumber(productCurrentStock)

  if (quantity !== null && stock !== null) {
    return String(Math.max(quantity - stock, 0))
  }

  if (quantity !== null) return String(quantity)
  return ''
}

const formatProductInventoryValidationForFrontend = (validation) => {
  if (!validation) return null

  const plainValidation = validation.get ? validation.get({ plain: true }) : validation
  const { approvalDocumentData, ...rest } = plainValidation
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

const mergeAccessData = (ssr, validation) => {
  const formattedValidation = formatProductInventoryValidationForFrontend(validation)
  const productCurrentStock = normalizeNullableString(ssr?.stsForm?.productCurrentStock) || ''

  return {
    ...ssr,
    productDesignation: ssr?.referenceDesignation || '',
    productCurrentStock,
    productionToLaunch: deriveProductionToLaunch({
      quantityRequested: ssr?.quantityRequested,
      productCurrentStock,
    }),
    productAvailableForSale: formattedValidation?.productAvailableForSale || '',
    productInventoryValidation: formattedValidation,
  }
}

const buildDocumentPayload = (file) => {
  if (!file) return null

  const relativeDocumentPath = path.relative(process.cwd(), file.path).replace(/\\/g, '/')

  return {
    approvalDocumentName: file.filename,
    approvalDocumentMimeType: file.mimetype || 'application/octet-stream',
    approvalDocumentSize: file.size,
    approvalDocumentData: Buffer.from(relativeDocumentPath, 'utf8'),
  }
}

const saveProductInventoryValidation = async (data, file) => {
  const ssr = await ssrService.getSmallSerialRequestById(data.ssrId)
  if (!ssr) throw new Error('SmallSerialRequest not found')

  const existingValidation = await ProductInventoryValidation.findOne({
    where: { ssrId: data.ssrId },
  })

  const payload = {
    ssrId: data.ssrId,
    productAvailableForSale: normalizeNullableString(data.productAvailableForSale),
  }

  if (!payload.productAvailableForSale) {
    throw new Error('productAvailableForSale is required')
  }

  const documentPayload = buildDocumentPayload(file)

  if (existingValidation) {
    await existingValidation.update({
      ...payload,
      ...(documentPayload || {}),
    })

    return formatProductInventoryValidationForFrontend(existingValidation)
  }

  if (!documentPayload) {
    throw new Error('approval document is required')
  }

  try {
    const validation = await ProductInventoryValidation.create({
      ...payload,
      ...documentPayload,
    })

    return formatProductInventoryValidationForFrontend(validation)
  } catch (error) {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }

    throw error
  }
}

const getProductInventoryValidationBySsrId = async (ssrId) => {
  const validation = await ProductInventoryValidation.findOne({
    where: { ssrId },
  })

  if (!validation) throw new Error('Product inventory validation not found')
  return formatProductInventoryValidationForFrontend(validation)
}

const getProductInventoryAccessDataBySsrId = async (ssrId) => {
  const ssr = await ssrService.getSmallSerialRequestById(ssrId)
  const validation = await ProductInventoryValidation.findOne({
    where: { ssrId },
  })

  return mergeAccessData(ssr, validation)
}

module.exports = {
  saveProductInventoryValidation,
  getProductInventoryValidationBySsrId,
  getProductInventoryAccessDataBySsrId,
}
