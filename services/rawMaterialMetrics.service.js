const { QueryTypes } = require('sequelize')
const { getWarehouseSequelize, isWarehouseConfigured } = require('../config/sequelizeWarehouse')

const normalizeNullableString = (value) => {
  if (value === undefined || value === null) return null

  const normalized = String(value).trim()
  return normalized ? normalized : null
}

const normalizeDateString = (value) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return normalizeNullableString(value) || ''
  }

  return date.toISOString().slice(0, 10)
}

const toPlainObject = (value) => (value?.get ? value.get({ plain: true }) : value)

const EMPTY_METRICS = Object.freeze({
  lastInventoryQuantity: '',
  lastInventoryDate: '',
  lastMovementPrice: '',
  lastMovementDate: '',
  rmCurrentStock: '',
  inventoryDateRm: '',
  lastPurchasePrice: '',
  lastPurchasingDate: '',
  lastSellingPrice: '',
  lastSellingDate: '',
})

const EMPTY_PRODUCT_METRICS = Object.freeze({
  lastInventoryQuantity: '',
  lastInventoryDate: '',
  lastSellingPrice: '',
  lastSellingDate: '',
  lastMovementPrice: '',
  lastMovementDate: '',
})

const RAW_MATERIAL_METRICS_QUERY = `
WITH LatestInventory AS (
    SELECT
        "Internal_reference",
        "Inventory_quantity",
        "Inventory_date"
    FROM (
        SELECT
            "Internal_reference",
            "Inventory_quantity",
            "Inventory_date",
            ROW_NUMBER() OVER (
                PARTITION BY "Internal_reference"
                ORDER BY "Inventory_date" DESC
            ) AS row_num
        FROM dw."FI-D6_Inventory"
        WHERE "Internal_reference" IN (:internalReferences)
    ) inventory_rows
    WHERE row_num = 1
),
LatestMovements AS (
    SELECT
        "Internal_reference",
        "Last_Movement_price",
        "Movement_date"
    FROM (
        SELECT
            "Internal_reference",
            ("Movement_value" / NULLIF("Quantity", 0)) AS "Last_Movement_price",
            "Movement_date",
            ROW_NUMBER() OVER (
                PARTITION BY "Internal_reference"
                ORDER BY "Movement_date" DESC
            ) AS row_num
        FROM dw."LO-D4_Movements"
        WHERE "Internal_reference" IN (:internalReferences)
          AND "Quantity" <> 0
          AND "Site" NOT IN ('Sceet')
    ) movement_rows
    WHERE row_num = 1
)
SELECT
    COALESCE(i."Internal_reference", m."Internal_reference") AS "internalReference",
    i."Inventory_quantity" AS "lastInventoryQuantity",
    i."Inventory_date" AS "lastInventoryDate",
    m."Last_Movement_price" AS "lastMovementPrice",
    m."Movement_date" AS "lastMovementDate"
FROM LatestInventory i
FULL OUTER JOIN LatestMovements m
    ON i."Internal_reference" = m."Internal_reference"
`

const PRODUCT_METRICS_QUERY = `
WITH FilteredInventory AS (
    SELECT
        "Internal_reference",
        "Inventory_quantity",
        "Inventory_date"
    FROM dw."FI-D6_Inventory"
    WHERE "Internal_reference" IN (:internalReferences)
),
LatestInventory AS (
    SELECT
        "Internal_reference",
        "Inventory_quantity",
        "Inventory_date"
    FROM (
        SELECT
            "Internal_reference",
            "Inventory_quantity",
            "Inventory_date",
            ROW_NUMBER() OVER (
                PARTITION BY "Internal_reference"
                ORDER BY "Inventory_date" DESC
            ) AS row_num
        FROM FilteredInventory
    ) inventory_rows
    WHERE row_num = 1
),
FilteredSales AS (
    SELECT
        "Internal_reference",
        ("Value_in_currency" / NULLIF("Qty", 0)) AS "Last_Selling_price",
        "Selling_date"
    FROM dw."FI-D7_Sales"
    WHERE "Qty" <> 0
      AND "Site" NOT IN ('Sceet')
      AND "Internal_reference" IN (:internalReferences)
),
LatestSales AS (
    SELECT
        "Internal_reference",
        "Last_Selling_price",
        "Selling_date"
    FROM (
        SELECT
            "Internal_reference",
            "Last_Selling_price",
            "Selling_date",
            ROW_NUMBER() OVER (
                PARTITION BY "Internal_reference"
                ORDER BY "Selling_date" DESC
            ) AS row_num
        FROM FilteredSales
    ) sales_rows
    WHERE row_num = 1
)
SELECT
    COALESCE(inv."Internal_reference", sales."Internal_reference") AS "internalReference",
    inv."Inventory_quantity" AS "lastInventoryQuantity",
    inv."Inventory_date" AS "lastInventoryDate",
    sales."Last_Selling_price" AS "lastSellingPrice",
    sales."Selling_date" AS "lastSellingDate"
FROM LatestInventory inv
FULL OUTER JOIN LatestSales sales
    ON inv."Internal_reference" = sales."Internal_reference"
`

let hasLoggedMissingConfigWarning = false

const getRawMaterialMetricsByInternalReferences = async (internalReferences = []) => {
  const normalizedReferences = [...new Set(
    internalReferences
      .map(normalizeNullableString)
      .filter(Boolean)
  )]

  if (normalizedReferences.length === 0) {
    return new Map()
  }

  if (!isWarehouseConfigured()) {
    if (!hasLoggedMissingConfigWarning) {
      hasLoggedMissingConfigWarning = true
      console.warn('DW database is not configured. Raw material stock and purchase price enrichment is disabled.')
    }

    return new Map(normalizedReferences.map((reference) => [reference, EMPTY_METRICS]))
  }

  const sequelize = getWarehouseSequelize()

  try {
    const rows = await sequelize.query(RAW_MATERIAL_METRICS_QUERY, {
      replacements: { internalReferences: normalizedReferences },
      type: QueryTypes.SELECT,
    })

    console.log('DW raw material metrics query result:', {
      requestedReferences: normalizedReferences,
      rowCount: rows.length,
      rows: rows.map((row) => ({
        internalReference: row.internalReference,
        lastInventoryQuantity: row.lastInventoryQuantity,
        lastInventoryDate: row.lastInventoryDate,
        lastMovementPrice: row.lastMovementPrice,
        lastMovementDate: row.lastMovementDate,
      })),
    })

    const metricsByReference = new Map(
      normalizedReferences.map((reference) => [reference, { ...EMPTY_METRICS }])
    )

    for (const row of rows) {
      const reference = normalizeNullableString(row.internalReference)
      if (!reference) continue

      metricsByReference.set(reference, {
        lastInventoryQuantity: normalizeNullableString(row.lastInventoryQuantity) || '',
        lastInventoryDate: normalizeDateString(row.lastInventoryDate),
        lastMovementPrice: normalizeNullableString(row.lastMovementPrice) || '',
        lastMovementDate: normalizeDateString(row.lastMovementDate),
        rmCurrentStock: normalizeNullableString(row.lastInventoryQuantity) || '',
        inventoryDateRm: normalizeDateString(row.lastInventoryDate),
        lastPurchasePrice: normalizeNullableString(row.lastMovementPrice) || '',
        lastPurchasingDate: normalizeDateString(row.lastMovementDate),
        lastSellingPrice: normalizeNullableString(row.lastMovementPrice) || '',
        lastSellingDate: normalizeDateString(row.lastMovementDate),
      })
    }

    return metricsByReference
  } catch (error) {
    console.error('raw material DW query error:', error.message)
    return new Map(normalizedReferences.map((reference) => [reference, { ...EMPTY_METRICS }]))
  }
}

const getProductMetricsByInternalReferences = async (internalReferences = []) => {
  const normalizedReferences = [...new Set(
    internalReferences
      .map(normalizeNullableString)
      .filter(Boolean)
  )]

  if (normalizedReferences.length === 0) {
    return new Map()
  }

  if (!isWarehouseConfigured()) {
    if (!hasLoggedMissingConfigWarning) {
      hasLoggedMissingConfigWarning = true
      console.warn('DW database is not configured. Raw material stock and purchase price enrichment is disabled.')
    }

    return new Map(normalizedReferences.map((reference) => [reference, { ...EMPTY_PRODUCT_METRICS }]))
  }

  const sequelize = getWarehouseSequelize()

  try {
    const rows = await sequelize.query(PRODUCT_METRICS_QUERY, {
      replacements: { internalReferences: normalizedReferences },
      type: QueryTypes.SELECT,
    })

    console.log('DW product inventory and sales query result:', {
      requestedReferences: normalizedReferences,
      rowCount: rows.length,
      rows: rows.map((row) => ({
        internalReference: row.internalReference,
        lastInventoryQuantity: row.lastInventoryQuantity,
        lastInventoryDate: row.lastInventoryDate,
        lastSellingPrice: row.lastSellingPrice,
        lastSellingDate: row.lastSellingDate,
      })),
    })

    const metricsByReference = new Map(
      normalizedReferences.map((reference) => [reference, { ...EMPTY_PRODUCT_METRICS }])
    )

    for (const row of rows) {
      const reference = normalizeNullableString(row.internalReference)
      if (!reference) continue

      const lastSellingPrice = normalizeNullableString(row.lastSellingPrice) || ''
      const lastSellingDate = normalizeDateString(row.lastSellingDate)

      metricsByReference.set(reference, {
        lastInventoryQuantity: normalizeNullableString(row.lastInventoryQuantity) || '',
        lastInventoryDate: normalizeDateString(row.lastInventoryDate),
        lastSellingPrice,
        lastSellingDate,
        lastMovementPrice: lastSellingPrice,
        lastMovementDate: lastSellingDate,
      })
    }

    return metricsByReference
  } catch (error) {
    console.error('product inventory and sales DW query error:', error.message)
    return new Map(normalizedReferences.map((reference) => [reference, { ...EMPTY_PRODUCT_METRICS }]))
  }
}

const enrichRawMaterialRowsWithMetrics = async (rawMaterials = []) => {
  if (!Array.isArray(rawMaterials) || rawMaterials.length === 0) {
    return []
  }

  const metricsByReference = await getRawMaterialMetricsByInternalReferences(
    rawMaterials.map((row) => {
      const plainRow = toPlainObject(row) || {}
      return normalizeNullableString(plainRow.partReference ?? plainRow.part_reference)
    })
  )

  return rawMaterials.map((row) => {
    const plainRow = toPlainObject(row) || {}
    const internalReference = normalizeNullableString(plainRow.partReference ?? plainRow.part_reference)
    const metrics = internalReference ? (metricsByReference.get(internalReference) || {}) : {}
    const lastSellingPrice = metrics.lastSellingPrice || normalizeNullableString(
      plainRow.lastSellingPrice ?? plainRow.last_selling_price ?? plainRow.lastPurchasePrice ?? plainRow.last_purchase_price
    ) || ''
    const lastSellingDate = metrics.lastSellingDate || normalizeDateString(
      plainRow.lastSellingDate ?? plainRow.last_selling_date ?? plainRow.lastPurchasingDate ?? plainRow.last_purchasing_date
    )

    return {
      ...plainRow,
      internalReference: internalReference || '',
      lastInventoryQuantity: metrics.lastInventoryQuantity || '',
      lastInventoryDate: metrics.lastInventoryDate || '',
      lastMovementPrice: metrics.lastMovementPrice || '',
      lastMovementDate: metrics.lastMovementDate || '',
      rmCurrentStock: metrics.rmCurrentStock || normalizeNullableString(plainRow.rmCurrentStock ?? plainRow.rm_current_stock) || '',
      lastPurchasePrice: lastSellingPrice,
      lastPurchasingDate: lastSellingDate,
      lastSellingPrice,
      lastSellingDate,
    }
  })
}

module.exports = {
  getRawMaterialMetricsByInternalReferences,
  getProductMetricsByInternalReferences,
  enrichRawMaterialRowsWithMetrics,
}
