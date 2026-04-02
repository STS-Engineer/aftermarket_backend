const STSForm = require('../models/stsForm.model')
const FourMValidation = require('../models/fourMValidation.model')
const RawMaterial = require('../models/rawMaterial.model')
const ssrService = require('./ssr.service')
const { getRawMaterialsByProductReference } = require('./productComposition.service')
const { getRawMaterialMetricsByInternalReferences } = require('./rawMaterialMetrics.service')

const normalizeNullableString = (value) => {
  if (value === undefined || value === null) return null

  const normalized = String(value).trim()
  return normalized ? normalized : null
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

const resolveLastSellingPrice = (row, scalarEntries = {}) => (
  normalizeNullableString(row?.lastSellingPrice)
  || normalizeNullableString(row?.lastPurchasePrice)
  || scalarEntries.lastSellingPrice
  || scalarEntries.lastPurchasePrice
  || ''
)

const resolveLastSellingDate = (row, scalarEntries = {}) => (
  normalizeNullableString(row?.lastSellingDate)
  || normalizeNullableString(row?.lastPurchasingDate)
  || scalarEntries.lastSellingDate
  || scalarEntries.lastPurchasingDate
  || ''
)

const resolveMinimumOrderQuantity = (row, scalarEntries = {}) => (
  normalizeNullableString(
    row?.minimumOrderQuantity ?? row?.minimum_order_quantity ?? row?.minimumOrderQty ?? row?.moq,
  )
  || scalarEntries.minimumOrderQuantity
  || scalarEntries.minimum_order_quantity
  || scalarEntries.minimumOrderQty
  || scalarEntries.moq
  || ''
)

const resolveLeadTimeWeek = (row, scalarEntries = {}) => (
  normalizeNullableString(
    row?.leadTimeWeek ??
      row?.leadTimeWeeks ??
      row?.lead_time_week ??
      row?.leadTime ??
      row?.lead_time ??
      row?.leadTimeInWeek,
  )
  || scalarEntries.leadTimeWeek
  || scalarEntries.leadTimeWeeks
  || scalarEntries.lead_time_week
  || scalarEntries.leadTime
  || scalarEntries.lead_time
  || scalarEntries.leadTimeInWeek
  || ''
)

const resolveOrderMultiplier = (row, scalarEntries = {}) => (
  normalizeNullableString(
    row?.xMoqToOrder ??
      row?.xMOQToOrder ??
      row?.x_moq_to_order ??
      row?.orderMultiplier ??
      row?.order_multiplier ??
      row?.multiplier,
  )
  || scalarEntries.xMoqToOrder
  || scalarEntries.xMOQToOrder
  || scalarEntries.x_moq_to_order
  || scalarEntries.orderMultiplier
  || scalarEntries.order_multiplier
  || scalarEntries.multiplier
  || ''
)

const resolveQuantityUnderOrder = (row, scalarEntries = {}) => (
  normalizeNullableString(
    row?.quantityUnderOrder ??
      row?.quantity_under_order ??
      row?.orderedQuantity ??
      row?.ordered_quantity ??
      row?.qtyUnderOrder,
  )
  || scalarEntries.quantityUnderOrder
  || scalarEntries.quantity_under_order
  || scalarEntries.orderedQuantity
  || scalarEntries.ordered_quantity
  || scalarEntries.qtyUnderOrder
  || ''
)

const resolveSupplierPriceProposal = (row, scalarEntries = {}) => (
  normalizeNullableString(
    row?.supplierPriceProposal ??
      row?.supplier_price_proposal ??
      row?.currentPurchasePrice ??
      row?.current_purchase_price,
  )
  || scalarEntries.supplierPriceProposal
  || scalarEntries.supplier_price_proposal
  || scalarEntries.currentPurchasePrice
  || scalarEntries.current_purchase_price
  || ''
)

const resolveProductFields = (source, productMetrics = {}) => ({
  productCurrentStock: normalizeNullableString(source?.productCurrentStock) || productMetrics.lastInventoryQuantity || '',
  lastSellingPrice: normalizeNullableString(source?.lastSellingPrice) || productMetrics.lastMovementPrice || '',
  lastSellingDate: normalizeNullableString(source?.lastSellingDate) || productMetrics.lastMovementDate || '',
})

const normalizeRawMaterials = (rawMaterials) => {
  if (!Array.isArray(rawMaterials)) return []

  return rawMaterials
    .map((row) => {
      const scalarEntries = Object.entries(row || {}).reduce((acc, [key, value]) => {
        if (value === undefined || value === null) return acc

        if (['string', 'number', 'boolean'].includes(typeof value)) {
          acc[key] = normalizeNullableString(value) || ''
        }

        return acc
      }, {})

      return {
        ...scalarEntries,
        partReference: normalizeNullableString(row?.partReference ?? row?.part_reference) || scalarEntries.partReference || scalarEntries.part_reference || '',
        referenceDesignation: normalizeNullableString(row?.referenceDesignation ?? row?.reference_designation) || scalarEntries.referenceDesignation || scalarEntries.reference_designation || '',
        quantityPerUnit: normalizeNullableString(row?.quantityPerUnit ?? row?.quantity_per_unit) || scalarEntries.quantityPerUnit || scalarEntries.quantity_per_unit || '',
        totalRequirement: normalizeNullableString(row?.totalRequirement ?? row?.total_requirement) || scalarEntries.totalRequirement || scalarEntries.total_requirement || '',
        inventoryDateRm: normalizeNullableString(row?.inventoryDateRm ?? row?.inventory_date_rm) || scalarEntries.inventoryDateRm || scalarEntries.inventory_date_rm || '',
        rmCurrentStock: normalizeNullableString(row?.rmCurrentStock ?? row?.rm_current_stock) || scalarEntries.rmCurrentStock || scalarEntries.rm_current_stock || '',
        rmAvailableForProd: normalizeNullableString(row?.rmAvailableForProd ?? row?.rm_available_for_prod) || scalarEntries.rmAvailableForProd || scalarEntries.rm_available_for_prod || '',
        totalNeeds: normalizeNullableString(row?.totalNeeds ?? row?.total_needs) || scalarEntries.totalNeeds || scalarEntries.total_needs || '',
        minimumOrderQuantity: resolveMinimumOrderQuantity(row, scalarEntries),
        leadTimeWeek: resolveLeadTimeWeek(row, scalarEntries),
        leadTimeWeeks: resolveLeadTimeWeek(row, scalarEntries),
        xMoqToOrder: resolveOrderMultiplier(row, scalarEntries),
        orderMultiplier: resolveOrderMultiplier(row, scalarEntries),
        quantityUnderOrder: resolveQuantityUnderOrder(row, scalarEntries),
        supplierPriceProposal: resolveSupplierPriceProposal(row, scalarEntries),
        currentPurchasePrice: resolveSupplierPriceProposal(row, scalarEntries),
        needStudyCase: normalizeNeedStudyCase(row?.needStudyCase ?? row?.need_study_case ?? scalarEntries.needStudyCase ?? scalarEntries.need_study_case),
        lastPurchasePrice: resolveLastSellingPrice(row, scalarEntries),
        lastPurchasingDate: resolveLastSellingDate(row, scalarEntries),
        lastSellingPrice: resolveLastSellingPrice(row, scalarEntries),
        lastSellingDate: resolveLastSellingDate(row, scalarEntries),
      }
    })
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

const getSsrProductReference = (ssr) => (
  normalizeNullableString(ssr?.productReference ?? ssr?.product_reference)
)

const getProductMetrics = async (ssr) => {
  const productReference = getSsrProductReference(ssr)
  if (!productReference) return null

  const metricsByReference = await getRawMaterialMetricsByInternalReferences([productReference])
  return metricsByReference.get(productReference) || null
}

const mergeRawMaterials = (productCompositionRawMaterials = [], savedRawMaterials = []) => {
  const normalizedSavedRawMaterials = normalizeRawMaterials(savedRawMaterials)
  if (productCompositionRawMaterials.length === 0) return normalizedSavedRawMaterials
  if (normalizedSavedRawMaterials.length === 0) return normalizeRawMaterials(productCompositionRawMaterials)

  const savedRowsByPartReference = normalizedSavedRawMaterials.reduce((acc, row) => {
    const partReferenceKey = normalizeNullableString(row?.partReference) || '__empty__'
    if (!acc.has(partReferenceKey)) {
      acc.set(partReferenceKey, [])
    }

    acc.get(partReferenceKey).push(row)
    return acc
  }, new Map())

  const mergedRows = productCompositionRawMaterials.map((row) => {
    const partReferenceKey = normalizeNullableString(row?.partReference) || '__empty__'
    const matchingSavedRows = savedRowsByPartReference.get(partReferenceKey) || []
    const savedRow = matchingSavedRows.length > 0 ? matchingSavedRows.shift() : null
    const lastSellingPrice = resolveLastSellingPrice(savedRow || row)
    const lastSellingDate = resolveLastSellingDate(savedRow || row)
    const minimumOrderQuantity = resolveMinimumOrderQuantity(savedRow || row, row)
    const leadTimeWeek = resolveLeadTimeWeek(savedRow || row, row)
    const orderMultiplier = resolveOrderMultiplier(savedRow || row, row)
    const quantityUnderOrder = resolveQuantityUnderOrder(savedRow || row, row)
    const supplierPriceProposal = resolveSupplierPriceProposal(savedRow || row, row)

    return {
      ...row,
      ...(savedRow || {}),
      partReference: normalizeNullableString(savedRow?.partReference) || row.partReference || '',
      quantityPerUnit: normalizeNullableString(savedRow?.quantityPerUnit) || row.quantityPerUnit || '',
      referenceDesignation: normalizeNullableString(savedRow?.referenceDesignation) || row.referenceDesignation || '',
      totalRequirement: normalizeNullableString(savedRow?.totalRequirement) || row.totalRequirement || row.total_requirement || '',
      inventoryDateRm: normalizeNullableString(savedRow?.inventoryDateRm) || row.inventoryDateRm || row.inventory_date_rm || '',
      rmCurrentStock: normalizeNullableString(savedRow?.rmCurrentStock) || '',
      rmAvailableForProd: normalizeNullableString(savedRow?.rmAvailableForProd) || row.rmAvailableForProd || row.rm_available_for_prod || '',
      totalNeeds: normalizeNullableString(savedRow?.totalNeeds) || row.totalNeeds || row.total_needs || '',
      minimumOrderQuantity,
      leadTimeWeek,
      leadTimeWeeks: leadTimeWeek,
      xMoqToOrder: orderMultiplier,
      orderMultiplier,
      quantityUnderOrder,
      supplierPriceProposal,
      currentPurchasePrice: supplierPriceProposal,
      needStudyCase: savedRow?.needStudyCase ?? row.needStudyCase ?? row.need_study_case ?? null,
      lastPurchasePrice: lastSellingPrice,
      lastPurchasingDate: lastSellingDate,
      lastSellingPrice,
      lastSellingDate,
    }
  })

  const remainingSavedRows = []
  for (const rows of savedRowsByPartReference.values()) {
    remainingSavedRows.push(...rows)
  }

  return normalizeRawMaterials([...mergedRows, ...remainingSavedRows])
}

const mergeSsrWithStsForm = (ssr, stsForm, productCompositionRawMaterials = [], productMetrics = null) => {
  const mergedRawMaterials = mergeRawMaterials(
    productCompositionRawMaterials,
    Array.isArray(stsForm?.rawMaterials) ? stsForm.rawMaterials : []
  )
  const normalizedProductMetrics = productMetrics || {}
  const resolvedProductFields = resolveProductFields(stsForm, normalizedProductMetrics)
  const mergedStsForm = stsForm
    ? {
      ...stsForm,
      ...resolvedProductFields,
      rawMaterials: mergedRawMaterials,
    }
    : null

  if (!stsForm) {
    return {
      ...ssr,
      stsForm: ssr?.stsForm || null,
      kamId: ssr.kam_id || null,
      avoPlant: ssr.plant || '',
      productDesignation: ssr.referenceDesignation || '',
      ...resolvedProductFields,
      lastInventoryQuantity: normalizedProductMetrics.lastInventoryQuantity || '',
      lastInventoryDate: normalizedProductMetrics.lastInventoryDate || '',
      lastMovementPrice: normalizedProductMetrics.lastMovementPrice || '',
      lastMovementDate: normalizedProductMetrics.lastMovementDate || '',
      productLastInventoryQuantity: normalizedProductMetrics.lastInventoryQuantity || '',
      productLastInventoryDate: normalizedProductMetrics.lastInventoryDate || '',
      productLastMovementPrice: normalizedProductMetrics.lastMovementPrice || '',
      productLastMovementDate: normalizedProductMetrics.lastMovementDate || '',
      rawMaterials: mergedRawMaterials,
    }
  }

  return {
    ...ssr,
    ...mergedStsForm,
    stsForm: mergedStsForm,
    kamId: ssr.kam_id || null,
    kam_id: ssr.kam_id || null,
    avoPlant: ssr.plant || '',
    productDesignation: ssr.referenceDesignation || '',
    referenceDesignation: ssr.referenceDesignation || '',
    ...resolvedProductFields,
    lastInventoryQuantity: normalizedProductMetrics.lastInventoryQuantity || '',
    lastInventoryDate: normalizedProductMetrics.lastInventoryDate || '',
    lastMovementPrice: normalizedProductMetrics.lastMovementPrice || '',
    lastMovementDate: normalizedProductMetrics.lastMovementDate || '',
    productLastInventoryQuantity: normalizedProductMetrics.lastInventoryQuantity || '',
    productLastInventoryDate: normalizedProductMetrics.lastInventoryDate || '',
    productLastMovementPrice: normalizedProductMetrics.lastMovementPrice || '',
    productLastMovementDate: normalizedProductMetrics.lastMovementDate || '',
    rawMaterials: mergedRawMaterials,
  }
}

const saveStsForm = async (data) => {
  const ssr = await ssrService.getSmallSerialRequestById(data.ssrId)
  if (!ssr) throw new Error('SmallSerialRequest not found')
  const [productCompositionRawMaterials, productMetrics] = await Promise.all([
    getRawMaterialsByProductReference(getSsrProductReference(ssr)),
    getProductMetrics(ssr),
  ])
  const resolvedProductFields = resolveProductFields(data, productMetrics || {})

  const payload = {
    ssrId: data.ssrId,
    productCurrentStock: resolvedProductFields.productCurrentStock || null,
    lastSellingPrice: resolvedProductFields.lastSellingPrice || null,
    lastSellingDate: resolvedProductFields.lastSellingDate || null,
    rawMaterials: mergeRawMaterials(productCompositionRawMaterials, data.rawMaterials),
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

const saveSpecificRMStudyForm = async (data) => {
  const result = await saveStsForm(data)

  try {
    const ssr = await ssrService.getSmallSerialRequestById(data.ssrId)
    const { sendSubmissionSummaryEmails } = require('../emailService/ssrSummary.mailer')

    await sendSubmissionSummaryEmails({
      ssr,
      submittedFormKey: 'specific-rm-study',
      submittedFormLabel: 'Specific RM Study Form',
    })
  } catch (error) {
    console.error('sendSubmissionSummaryEmails for Specific RM Study error:', error.message)
  }

  return result
}

const getStsFormBySsrId = async (ssrId) => {
  const [ssr, form] = await Promise.all([
    ssrService.getSmallSerialRequestById(ssrId),
    STSForm.findOne({
      where: { ssrId },
    }),
  ])

  if (!form) throw new Error('STS form not found')

  const [productCompositionRawMaterials, productMetrics] = await Promise.all([
    getRawMaterialsByProductReference(getSsrProductReference(ssr)),
    getProductMetrics(ssr),
  ])

  return mergeSsrWithStsForm(
    ssr,
    formatStsFormForFrontend(form),
    productCompositionRawMaterials,
    productMetrics
  )
}

const getStsAccessDataBySsrId = async (ssrId) => {
  const [ssr, existingForm] = await Promise.all([
    ssrService.getSmallSerialRequestById(ssrId),
    STSForm.findOne({
      where: { ssrId },
    }),
  ])

  const [productCompositionRawMaterials, productMetrics] = await Promise.all([
    getRawMaterialsByProductReference(getSsrProductReference(ssr)),
    getProductMetrics(ssr),
  ])
  const formattedForm = existingForm ? formatStsFormForFrontend(existingForm) : null
  return mergeSsrWithStsForm(ssr, formattedForm, productCompositionRawMaterials, productMetrics)
}

const getSpecificRMStudyAccessDataBySsrId = async (ssrId) => {
  const accessData = await getStsAccessDataBySsrId(ssrId)
  const savedRawMaterials = await RawMaterial.findAll({
    where: { ssrId },
    order: [['orderIndex', 'ASC']],
  })

  const mergedRawMaterials = ssrService.mergeRMAvailabilityRawMaterials(
    Array.isArray(accessData?.rawMaterials)
      ? accessData.rawMaterials
      : Array.isArray(accessData?.stsForm?.rawMaterials)
        ? accessData.stsForm.rawMaterials
        : [],
    savedRawMaterials,
  )

  return {
    ...accessData,
    rawMaterials: mergedRawMaterials,
    raw_materials: mergedRawMaterials,
    stsForm: accessData?.stsForm
      ? {
        ...accessData.stsForm,
        rawMaterials: mergedRawMaterials,
        raw_materials: mergedRawMaterials,
      }
      : accessData?.stsForm,
  }
}

module.exports = {
  saveStsForm,
  saveSpecificRMStudyForm,
  getStsFormBySsrId,
  getStsAccessDataBySsrId,
  getSpecificRMStudyAccessDataBySsrId,
}
