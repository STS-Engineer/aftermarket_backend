const RMAvailabilityValidation = require('../models/rmAvailabilityValidation.model')
const RawMaterial = require('../models/rawMaterial.model')
const ssrService = require('./ssr.service')
const sequelize = require('../config/sequelize')
const fs = require('fs')
const path = require('path')

const formatRMAvailabilityValidationForFrontend = (validation) => {
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
    approvalDocumentName: rest.approvalDocumentName || (approvalDocumentPath ? path.basename(approvalDocumentPath) : null),
    hasApprovalDocument: !!approvalDocumentPath,
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

const mergeAccessData = (ssr, validation) => ({
  ...ssr,
  quantityRequested: ssr?.quantityRequested ?? null,
  quantityRequestedProduct: ssr?.quantityRequested ?? null,
  productAvailableForSale: ssrService.normalizeNullableString(ssr?.productInventoryValidation?.productAvailableForSale) || '',
  rawMaterials: ssrService.mergeRMAvailabilityRawMaterials(
    ssrService.getBaseRawMaterials(ssr),
    Array.isArray(ssr?.rmAvailabilityRawMaterials) ? ssr.rmAvailabilityRawMaterials : []
  ),
  rmAvailabilityValidation: formatRMAvailabilityValidationForFrontend(validation),
})

const saveRMAvailabilityValidation = async (data, file) => {
  const ssr = await ssrService.getSmallSerialRequestById(data.ssrId)
  if (!ssr) throw new Error('SmallSerialRequest not found')
  const rawMaterialRecords = ssrService.buildRawMaterialRecordsForStorage(data.rawMaterials)

  const existingValidation = await RMAvailabilityValidation.findOne({
    where: { ssrId: data.ssrId },
  })

  const documentPayload = buildDocumentPayload(file)

  let savedValidation = null
  const transaction = await sequelize.transaction()

  try {
    if (existingValidation) {
      if (!documentPayload) {
        savedValidation = existingValidation
      } else {
        await existingValidation.update(documentPayload, { transaction })
        savedValidation = existingValidation
      }
    } else {
      if (!documentPayload) {
        throw new Error('approval document is required')
      }

      savedValidation = await RMAvailabilityValidation.create({
        ssrId: data.ssrId,
        ...documentPayload,
      }, { transaction })
    }

    await RawMaterial.destroy({
      where: { ssrId: data.ssrId },
      transaction,
    })

    if (rawMaterialRecords.length > 0) {
      await RawMaterial.bulkCreate(
        rawMaterialRecords.map((row) => ({
          ssrId: data.ssrId,
          ...row,
        })),
        { transaction }
      )
    }

    await transaction.commit()
  } catch (error) {
    await transaction.rollback()

    if (!existingValidation && file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }

    throw error
  }

  return formatRMAvailabilityValidationForFrontend(savedValidation)
}

const getRMAvailabilityValidationBySsrId = async (ssrId) => {
  const validation = await RMAvailabilityValidation.findOne({
    where: { ssrId },
  })

  if (!validation) throw new Error('RM availability validation not found')
  return formatRMAvailabilityValidationForFrontend(validation)
}

const getRMAvailabilityAccessDataBySsrId = async (ssrId) => {
  const ssr = await ssrService.getSmallSerialRequestById(ssrId)
  const validation = await RMAvailabilityValidation.findOne({
    where: { ssrId },
  })

  return mergeAccessData(ssr, validation)
}

module.exports = {
  saveRMAvailabilityValidation,
  getRMAvailabilityValidationBySsrId,
  getRMAvailabilityAccessDataBySsrId,
}
