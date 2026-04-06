const SPECIFIC_RM_REQUIRED_FIELDS = [
  ['minimumOrderQuantity', 'minimum_order_quantity', 'minimumOrderQty', 'moq'],
  ['xMoqToOrder', 'xMOQToOrder', 'x_moq_to_order', 'orderMultiplier', 'order_multiplier', 'multiplier'],
  ['quantityUnderOrder', 'quantity_under_order', 'orderedQuantity', 'ordered_quantity', 'qtyUnderOrder'],
  ['leadTimeWeek', 'leadTimeWeeks', 'lead_time_week', 'leadTime', 'lead_time', 'leadTimeInWeek'],
  ['supplierPriceProposal', 'supplier_price_proposal', 'currentPurchasePrice', 'current_purchase_price'],
]

const WORKFLOW_FORMS = [
  { key: 'fourM', label: '4M Validation' },
  { key: 'sts', label: 'STS Form' },
  { key: 'productInventory', label: 'Product Inventory' },
  { key: 'rmAvailability', label: 'RM Availability' },
  { key: 'specificRMStudy', label: 'Specific RM Study' },
]

const hasMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  return String(value).trim() !== ''
}

const normalizeNeedStudyCase = (value) => {
  if (value === true) return true
  if (value === false) return false
  if (typeof value === 'number') return value === 1

  const normalized = String(value || '').trim().toLowerCase()
  return ['yes', 'true', '1', 'oui'].includes(normalized)
}

const getRawMaterials = (request) => {
  if (Array.isArray(request?.rawMaterials)) return request.rawMaterials
  if (Array.isArray(request?.raw_materials)) return request.raw_materials
  if (Array.isArray(request?.stsForm?.rawMaterials)) return request.stsForm.rawMaterials
  if (Array.isArray(request?.stsForm?.raw_materials)) return request.stsForm.raw_materials
  return []
}

const getSpecificRMStudyRows = (request) => (
  getRawMaterials(request).filter((row) => normalizeNeedStudyCase(row?.needStudyCase ?? row?.need_study_case))
)

const isSpecificRMStudyRowCompleted = (row) => (
  SPECIFIC_RM_REQUIRED_FIELDS.every((keys) => keys.some((key) => hasMeaningfulValue(row?.[key])))
)

const getSpecificRMStudyState = (request) => {
  if (!request?.rmAvailabilityValidation) {
    return { status: 'waiting', actionable: false }
  }

  const needStudyRows = getSpecificRMStudyRows(request)
  if (needStudyRows.length === 0) {
    return { status: 'not_needed', actionable: false }
  }

  if (needStudyRows.every(isSpecificRMStudyRowCompleted)) {
    return { status: 'completed', actionable: false }
  }

  return { status: 'pending', actionable: true }
}

const getWorkflowStatusMap = (request) => {
  const fourM = request?.fourMValidation ? 'completed' : 'pending'
  const sts = request?.stsForm ? 'completed' : 'pending'
  const productInventory = !request?.stsForm
    ? 'waiting'
    : request?.productInventoryValidation
      ? 'completed'
      : 'pending'
  const rmAvailability = !request?.productInventoryValidation
    ? 'waiting'
    : request?.rmAvailabilityValidation
      ? 'completed'
      : 'pending'
  const specificRMStudy = getSpecificRMStudyState(request).status

  return {
    fourM,
    sts,
    productInventory,
    rmAvailability,
    specificRMStudy,
  }
}

const getWorkflowStartDate = (request, formKey) => {
  switch (formKey) {
    case 'fourM':
    case 'sts':
      return request?.createdAt || null
    case 'productInventory':
      return request?.stsForm?.updatedAt || request?.stsForm?.createdAt || null
    case 'rmAvailability':
      return request?.productInventoryValidation?.updatedAt || request?.productInventoryValidation?.createdAt || null
    case 'specificRMStudy':
      return request?.rmAvailabilityValidation?.updatedAt || request?.rmAvailabilityValidation?.createdAt || null
    default:
      return null
  }
}

const getActionablePendingForms = (request) => {
  const statusMap = getWorkflowStatusMap(request)
  return WORKFLOW_FORMS
    .filter((form) => statusMap[form.key] === 'pending')
    .map((form) => ({
      ...form,
      startedAt: getWorkflowStartDate(request, form.key),
    }))
}

const isWorkflowCompleted = (request) => {
  const statusMap = getWorkflowStatusMap(request)

  return (
    statusMap.fourM === 'completed' &&
    statusMap.sts === 'completed' &&
    statusMap.productInventory === 'completed' &&
    statusMap.rmAvailability === 'completed' &&
    ['completed', 'not_needed'].includes(statusMap.specificRMStudy)
  )
}

module.exports = {
  WORKFLOW_FORMS,
  getRawMaterials,
  getSpecificRMStudyRows,
  getWorkflowStatusMap,
  getWorkflowStartDate,
  getActionablePendingForms,
  isWorkflowCompleted,
}
