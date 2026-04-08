const FourMValidation = require('../models/fourMValidation.model')
const SmallSerialRequest = require('../models/ssr.model')
const ssrService = require('./ssr.service')
const fs = require('fs')
const path = require('path')

const formatValidationForFrontend = (validation) => {
  if (!validation) return null

  const plainValidation = validation.get ? validation.get({ plain: true }) : validation
  const { documentData, ...rest } = plainValidation
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

const mergeAccessData = (ssr, validation) => {
  const formattedValidation = formatValidationForFrontend(validation)

  return {
    ...ssr,
    ...(formattedValidation || {}),
    fourMValidation: formattedValidation,
  }
}

const saveFourMValidation = async (data, file) => {
  const request = await SmallSerialRequest.findByPk(data.ssrId)
  if (!request) throw new Error('SmallSerialRequest not found')

  const existingValidation = await FourMValidation.findOne({
    where: { ssrId: data.ssrId }
  })

  if (!existingValidation && !file) {
    throw new Error('document is required')
  }

  const documentPayload = file
    ? {
      documentName: file.filename,
      documentMimeType: file.mimetype || 'application/octet-stream',
      documentSize: file.size,
      documentData: Buffer.from(path.relative(process.cwd(), file.path).replace(/\\/g, '/'), 'utf8'),
    }
    : null

  try {
    let validation = null

    if (existingValidation) {
      await existingValidation.update({
        ...data,
        ...(documentPayload || {}),
      })

      validation = existingValidation
    } else {
      validation = await FourMValidation.create({
        ...data,
        ...documentPayload,
      })
    }

    return formatValidationForFrontend(validation)
  } catch (error) {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }

    throw error
  }
}

const getFourMAccessDataBySsrId = async (ssrId) => {
  const ssr = await ssrService.getSmallSerialRequestById(ssrId)
  return mergeAccessData(ssr, ssr?.fourMValidation)
}

const getFourMValidationBySsrId = async (ssrId) => {
  const validation = await FourMValidation.findOne({
    where: { ssrId }
  })

  if (!validation) throw new Error('4M validation not found')

  return formatValidationForFrontend(validation)
}

module.exports = {
  saveFourMValidation,
  getFourMAccessDataBySsrId,
  getFourMValidationBySsrId,
}
