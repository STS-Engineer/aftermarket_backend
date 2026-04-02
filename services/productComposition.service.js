const ProductComposition = require('../models/ProductComposition')
const { getRawMaterialMetricsByInternalReferences } = require('./rawMaterialMetrics.service')

const normalizeNullableString = (value) => {
  if (value === undefined || value === null) return null

  const normalized = String(value).trim()
  return normalized ? normalized : null
}

const toPlainRow = (row) => (row?.get ? row.get({ plain: true }) : row)

const mapProductCompositionToRawMaterial = (row) => {
  const plainRow = toPlainRow(row)

  return {
    partReference: normalizeNullableString(plainRow?.ref_compo_child_pro) || '',
    referenceDesignation: normalizeNullableString(plainRow?.compo_description) || '',
    quantityPerUnit: normalizeNullableString(plainRow?.compo_qty_child_unit) || '',
    rmCurrentStock: '',
    lastPurchasePrice: '',
    lastSellingPrice: '',
    lastSellingDate: '',
    refMainProduct: normalizeNullableString(plainRow?.ref_main_product) || '',
    refCompoChildPro: normalizeNullableString(plainRow?.ref_compo_child_pro) || '',
    compoDescription: normalizeNullableString(plainRow?.compo_description) || '',
    compoChildUnit: normalizeNullableString(plainRow?.compo_child_unit) || '',
    purCompoQtyUnit: normalizeNullableString(plainRow?.pur_compo_qty_unit) || '',
    purCompoUnit: normalizeNullableString(plainRow?.pur_compo_unit) || '',
    compta: normalizeNullableString(plainRow?.compta) || '',
    site: normalizeNullableString(plainRow?.site) || '',
  }
}

const getRawMaterialsByProductReference = async (productReference) => {
  const normalizedProductReference = normalizeNullableString(productReference)
  if (!normalizedProductReference) return []

  const productCompositions = await ProductComposition.findAll({
    where: {
      ref_main_product: normalizedProductReference,
    },
    order: [['id', 'ASC']],
  })

  const rawMaterials = productCompositions.map(mapProductCompositionToRawMaterial)
  const metricsByReference = await getRawMaterialMetricsByInternalReferences(
    rawMaterials.map((row) => row.partReference)
  )

  return rawMaterials.map((row) => {
    const metrics = metricsByReference.get(normalizeNullableString(row.partReference)) || {}

    return {
      ...row,
      lastInventoryQuantity: metrics.lastInventoryQuantity || '',
      lastInventoryDate: metrics.lastInventoryDate || '',
      lastMovementPrice: metrics.lastMovementPrice || '',
      lastMovementDate: metrics.lastMovementDate || '',
      rmCurrentStock: metrics.rmCurrentStock || row.rmCurrentStock || '',
      inventoryDateRm: metrics.inventoryDateRm || '',
      lastPurchasePrice: metrics.lastPurchasePrice || row.lastPurchasePrice || '',
      lastPurchasingDate: metrics.lastPurchasingDate || '',
      lastSellingPrice: metrics.lastSellingPrice || row.lastSellingPrice || row.lastPurchasePrice || '',
      lastSellingDate: metrics.lastSellingDate || row.lastSellingDate || row.lastPurchasingDate || '',
    }
  })
}

module.exports = {
  getRawMaterialsByProductReference,
}
