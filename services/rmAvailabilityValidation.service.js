const RMAvailabilityValidation = require('../models/rmAvailabilityValidation.model')
const ssrService = require('./ssr.service')
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
  rawMaterials: Array.isArray(ssr?.stsForm?.rawMaterials) ? ssr.stsForm.rawMaterials : [],
  rmAvailabilityValidation: formatRMAvailabilityValidationForFrontend(validation),
})

const saveRMAvailabilityValidation = async (data, file) => {
  const ssr = await ssrService.getSmallSerialRequestById(data.ssrId)
  if (!ssr) throw new Error('SmallSerialRequest not found')

  const existingValidation = await RMAvailabilityValidation.findOne({
    where: { ssrId: data.ssrId },
  })

  const documentPayload = buildDocumentPayload(file)

  let savedValidation = null

  if (existingValidation) {
    if (!documentPayload) {
      savedValidation = existingValidation
    } else {
      await existingValidation.update(documentPayload)
      savedValidation = existingValidation
    }
  } else {
    if (!documentPayload) {
      throw new Error('approval document is required')
    }

    try {
      savedValidation = await RMAvailabilityValidation.create({
        ssrId: data.ssrId,
        ...documentPayload,
      })
    } catch (error) {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path)
      }

      throw error
    }
  }

  try {
    const refreshedSsr = await ssrService.getSmallSerialRequestById(data.ssrId)
    const { sendSubmissionSummaryEmails } = require('../emailService/ssrSummary.mailer')

    await sendSubmissionSummaryEmails({
      ssr: refreshedSsr,
      submittedFormKey: 'rm-availability-validation',
      submittedFormLabel: 'RM Availability Validation Form',
    })
  } catch (error) {
    console.error('sendSubmissionSummaryEmails for RM Availability error:', error.message)
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
