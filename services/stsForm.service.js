const STSForm = require('../models/stsForm.model')
const FourMValidation = require('../models/fourMValidation.model')
const ssrService = require('./ssr.service')

const normalizeNullableString = (value) => {
  if (value === undefined || value === null) return null

  const normalized = String(value).trim()
  return normalized ? normalized : null
}

const normalizeRawMaterials = (rawMaterials) => {
  if (!Array.isArray(rawMaterials)) return []

  return rawMaterials
    .map((row) => ({
      partReference: normalizeNullableString(row?.partReference) || '',
      referenceDesignation: normalizeNullableString(row?.referenceDesignation) || '',
      quantityPerUnit: normalizeNullableString(row?.quantityPerUnit) || '',
      rmCurrentStock: normalizeNullableString(row?.rmCurrentStock) || '',
      lastPurchasePrice: normalizeNullableString(row?.lastPurchasePrice) || '',
    }))
    .filter((row) => Object.values(row).some((value) => value))
}

const formatStsFormForFrontend = (form) => {
  if (!form) return null

  const plainForm = form.get({ plain: true })

  return plainForm
}

const formatFourMValidationForEmail = (validation) => {
  if (!validation) return null

  const plainValidation = validation.get({ plain: true })
  const { documentData, ...rest } = plainValidation

  return rest
}

const mergeSsrWithStsForm = (ssr, stsForm) => {
  if (!stsForm) {
    return {
      ...ssr,
      kamId: ssr.kam_id || null,
      avoPlant: ssr.plant || '',
      productDesignation: ssr.referenceDesignation || '',
      status1: '',
      productCurrentStock: '',
      lastSellingPrice: '',
      lastSellingDate: '',
      status1: '',
      rawMaterials: [],
    }
  }

  return {
    ...ssr,
    ...stsForm,
    kamId: ssr.kam_id || null,
    kam_id: ssr.kam_id || null,
    avoPlant: ssr.plant || '',
    productDesignation: ssr.referenceDesignation || '',
    referenceDesignation: ssr.referenceDesignation || '',
    rawMaterials: Array.isArray(stsForm.rawMaterials) ? stsForm.rawMaterials : [],
  }
}

const saveStsForm = async (data) => {
  const ssr = await ssrService.getSmallSerialRequestById(data.ssrId)
  if (!ssr) throw new Error('SmallSerialRequest not found')

  const payload = {
    ssrId: data.ssrId,
    productCurrentStock: data.productCurrentStock,
    lastSellingPrice: data.lastSellingPrice,
    lastSellingDate: data.lastSellingDate,
    status1: data.status1,
    rawMaterials: normalizeRawMaterials(data.rawMaterials),
  }

  const existingForm = await STSForm.findOne({
    where: { ssrId: data.ssrId },
  })

  if (existingForm) {
    await existingForm.update(payload)
    return formatStsFormForFrontend(existingForm)
  }

  const form = await STSForm.create(payload)

  try {
    const [ssr, fourMValidation] = await Promise.all([
      ssrService.getSmallSerialRequestById(data.ssrId),
      FourMValidation.findOne({ where: { ssrId: data.ssrId } }),
    ])

    const { sendStsFormSubmittedEmailToFadwa } = require('../emailService/ssr.mailer')
    await sendStsFormSubmittedEmailToFadwa({
      ssr,
      fourMValidation: formatFourMValidationForEmail(fourMValidation),
      stsForm: formatStsFormForFrontend(form),
    })
  } catch (error) {
    console.error('sendStsFormSubmittedEmailToFadwa error:', error.message)
  }

  return formatStsFormForFrontend(form)
}

const getStsFormBySsrId = async (ssrId) => {
  const ssr = await ssrService.getSmallSerialRequestById(ssrId)
  const form = await STSForm.findOne({
    where: { ssrId },
  })

  if (!form) throw new Error('STS form not found')

  return mergeSsrWithStsForm(ssr, formatStsFormForFrontend(form))
}

const getStsAccessDataBySsrId = async (ssrId) => {
  const ssr = await ssrService.getSmallSerialRequestById(ssrId)
  const existingForm = await STSForm.findOne({
    where: { ssrId },
  })

  const formattedForm = existingForm ? formatStsFormForFrontend(existingForm) : null
  return mergeSsrWithStsForm(ssr, formattedForm)
}

module.exports = {
  saveStsForm,
  getStsFormBySsrId,
  getStsAccessDataBySsrId,
}
