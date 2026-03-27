const FourMValidation = require('../models/fourMValidation.model')
const SmallSerialRequest = require('../models/ssr.model')
const fs = require('fs')
const path = require('path')

const formatValidationForFrontend = (validation) => {
  if (!validation) return null

  const plainValidation = validation.get({ plain: true })
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

const createFourMValidation = async (data, file) => {
  const request = await SmallSerialRequest.findByPk(data.ssrId)
  if (!request) throw new Error('SmallSerialRequest not found')

  const existingValidation = await FourMValidation.findOne({
    where: { ssrId: data.ssrId }
  })

  if (existingValidation) {
    throw new Error('4M validation already exists for this request')
  }

  const relativeDocumentPath = path.relative(process.cwd(), file.path).replace(/\\/g, '/')

  try {
    const validation = await FourMValidation.create({
      ...data,
      documentName: file.filename,
      documentMimeType: file.mimetype || 'application/octet-stream',
      documentSize: file.size,
      documentData: Buffer.from(relativeDocumentPath, 'utf8'),
    })

    return formatValidationForFrontend(validation)
  } catch (error) {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }

    throw error
  }
}

const getFourMValidationBySsrId = async (ssrId) => {
  const validation = await FourMValidation.findOne({
    where: { ssrId }
  })

  if (!validation) throw new Error('4M validation not found')

  return formatValidationForFrontend(validation)
}

module.exports = {
  createFourMValidation,
  getFourMValidationBySsrId,
}
