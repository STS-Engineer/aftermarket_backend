const { getSalesRepDisplayName } = require('../utils/salesRep')

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const formatDate = (value) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toISOString().slice(0, 10)
}

const formatBooleanStatus = (value) => {
  if (value === true) return 'OK'
  if (value === false) return 'NOK'
  return ''
}

const getKamName = (ssr) => {
  const fullName = getSalesRepDisplayName(ssr?.kam)
  if (fullName) return fullName

  if (typeof ssr?.kam === 'string' && ssr.kam.trim()) {
    return ssr.kam.trim()
  }

  if (ssr?.kamName) return ssr.kamName
  if (ssr?.kam_id || ssr?.kamId) return `KAM #${ssr.kam_id || ssr.kamId}`
  return ''
}

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const raw = String(value).trim()
  if (!raw) return null

  const compact = raw.replace(/\s+/g, '')
  const lastComma = compact.lastIndexOf(',')
  const lastDot = compact.lastIndexOf('.')

  let normalized = compact

  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? compact.replace(/\./g, '').replace(',', '.')
      : compact.replace(/,/g, '')
  } else if (lastComma !== -1) {
    normalized = compact.replace(',', '.')
  }

  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

const pickFirst = (source, keys) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source || {}, key)) continue

    const value = source[key]
    if (value === undefined || value === null) continue

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
      continue
    }

    return value
  }

  return ''
}

const getRawMaterials = (ssr) => {
  if (Array.isArray(ssr?.rawMaterials)) return ssr.rawMaterials
  if (Array.isArray(ssr?.stsForm?.rawMaterials)) return ssr.stsForm.rawMaterials
  return []
}

const mapRawMaterial = (row = {}) => {
  const currentPurchasePrice = pickFirst(row, [
    'supplierPriceProposal',
    'supplier_price_proposal',
    'currentPurchasePrice',
    'current_purchase_price',
    'purchasePrice',
  ])

  const lastPurchasePrice = pickFirst(row, [
    'lastPurchasePrice',
    'last_purchase_price',
  ])

  const rawNeedStudyCase = pickFirst(row, ['needStudyCase', 'need_study_case', 'studyCase'])

  return {
    partReference: pickFirst(row, ['partReference', 'part_reference', 'subitem', 'subItem', 'name']),
    referenceDesignation: pickFirst(row, [
      'referenceDesignation',
      'reference_designation',
      'referenceDescription',
      'reference_description',
      'designation',
      'description',
    ]),
    quantityPerUnit: pickFirst(row, ['quantityPerUnit', 'quantity_per_unit', 'qLien', 'q_lien']),
    totalRequirement: pickFirst(row, ['totalRequirement', 'total_requirement']),
    rmCurrentStock: pickFirst(row, ['rmCurrentStock', 'rm_current_stock', 'currentStock']),
    inventoryDateRm: formatDate(pickFirst(row, ['inventoryDateRm', 'inventoryDateRM', 'inventoryDate', 'inventory_date_rm'])),
    rmStockAvailableForProd: pickFirst(row, [
      'rmAvailableForProd',
      'rm_available_for_prod',
      'rmStockAvailableForProd',
      'rmStockAvailable',
      'rm_stock_available_for_prod',
      'stockAvailableForProd',
    ]),
    totalNeeds: pickFirst(row, ['totalNeeds', 'total_needs']),
    minimumOrderQuantity: pickFirst(row, ['minimumOrderQuantity', 'minimum_order_quantity', 'minimumOrderQty', 'moq']),
    leadTimeWeeks: pickFirst(row, ['leadTimeWeeks', 'leadTimeWeek', 'leadTime', 'lead_time', 'leadTimeInWeek']),
    currentPurchasePrice: currentPurchasePrice || lastPurchasePrice || '',
    lastPurchasePrice,
    lastPurchasingDate: formatDate(pickFirst(row, ['lastPurchasingDate', 'lastPurchaseDate', 'last_purchasing_date'])),
    orderMultiplier: pickFirst(row, ['orderMultiplier', 'xMoqToOrder', 'xMOQToOrder', 'xMoq', 'multiplier']) || '1',
    quantityUnderOrder: pickFirst(row, ['quantityUnderOrder', 'quantity_under_order', 'orderedQuantity', 'ordered_quantity', 'qtyUnderOrder']),
    needStudyCase: typeof rawNeedStudyCase === 'boolean'
      ? (rawNeedStudyCase ? 'yes' : 'no')
      : rawNeedStudyCase,
  }
}

const cell = ({ value = '', type = 'String', styleId = 'Text', formula = null, mergeAcross = null } = {}) => {
  const attrs = []

  if (styleId) attrs.push(`ss:StyleID="${styleId}"`)
  if (formula) attrs.push(`ss:Formula="${escapeXml(formula)}"`)
  if (mergeAcross !== null && mergeAcross !== undefined) attrs.push(`ss:MergeAcross="${mergeAcross}"`)

  if (value === '' || value === null || value === undefined) {
    return `<Cell${attrs.length ? ` ${attrs.join(' ')}` : ''}/>`
  }

  return `<Cell${attrs.length ? ` ${attrs.join(' ')}` : ''}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`
}

const numberCell = (value, styleId = 'Number', formula = null) => {
  const numericValue = toFiniteNumber(value)
  return cell({
    value: numericValue !== null ? numericValue : '',
    type: 'Number',
    styleId,
    formula,
  })
}

const textCell = (value, styleId = 'Text', formula = null, mergeAcross = null) => (
  cell({
    value: value === null || value === undefined ? '' : String(value),
    type: 'String',
    styleId,
    formula,
    mergeAcross,
  })
)

const buildSummaryRow = (ssr, rawMaterials, rawStartRow, rawEndRow) => {
  const fourM = ssr?.fourMValidation || {}
  const sts = ssr?.stsForm || {}
  const productInventory = ssr?.productInventoryValidation || {}
  const rmAvailability = ssr?.rmAvailabilityValidation || {}

  const rawReferences = rawMaterials
    .map((row) => row.partReference)
    .filter(Boolean)
    .join(', ')

  const fgInventoryDate = formatDate(productInventory.updatedAt || productInventory.createdAt)

  const rmAvailabilityDocument = rmAvailability.approvalDocumentPath || rmAvailability.approvalDocumentName || ''
  const productInventoryDocument = productInventory.approvalDocumentPath || productInventory.approvalDocumentName || ''
  const fourMDocument = fourM.documentPath || fourM.documentName || ''

  const longestLeadTimeFormula = rawMaterials.length > 0
    ? `=IF(COUNTA(R${rawStartRow}C11:R${rawEndRow}C11)>0,MAX(R${rawStartRow}C11:R${rawEndRow}C11),0)`
    : null

  const totalAdditionalCostFormula = rawMaterials.length > 0
    ? `=SUM(R${rawStartRow}C20:R${rawEndRow}C20)`
    : '=0'

  return `
    <Row ss:Height="22">
      ${textCell(ssr?.productReference || '', 'TextStrong')}
      ${textCell(rawReferences)}
      ${numberCell(ssr?.id, 'Number')}
      ${textCell(getKamName(ssr))}
      ${textCell(ssr?.plant || ssr?.avoPlant || '')}
      ${textCell(ssr?.referenceDesignation || ssr?.productDesignation || '')}
      ${numberCell(ssr?.quantityRequested, 'NumberStrong')}
      ${textCell(formatDate(ssr?.dateRequested))}
      ${textCell('')}
      ${numberCell(sts?.productCurrentStock, 'Number')}
      ${textCell(fgInventoryDate)}
      ${textCell(productInventory?.productAvailableForSale || '')}
      ${textCell(rmAvailabilityDocument)}
      ${textCell(productInventoryDocument)}
      ${numberCell(sts?.lastSellingPrice, 'Currency')}
      ${textCell(formatDate(sts?.lastSellingDate))}
      ${textCell(formatBooleanStatus(fourM?.machineOk))}
      ${textCell(fourM?.machineExplanation || '')}
      ${textCell(formatDate(fourM?.machineDueDate))}
      ${textCell(formatBooleanStatus(fourM?.methodOk))}
      ${textCell(fourM?.methodExplanation || '')}
      ${textCell(formatDate(fourM?.methodDueDate))}
      ${textCell(formatBooleanStatus(fourM?.laborOk))}
      ${textCell(fourM?.laborExplanation || '')}
      ${textCell(formatDate(fourM?.laborDueDate))}
      ${textCell(formatBooleanStatus(fourM?.environmentOk))}
      ${textCell(fourM?.environmentExplanation || '')}
      ${textCell(formatDate(fourM?.environmentDueDate))}
      ${textCell(fourMDocument)}
      ${numberCell(0, 'Number', '=MAX(R4C7-R4C10,0)')}
      ${numberCell(0, 'Number', '=IF(R4C33>0,ROUNDUP(R4C30/R4C33,0),0)')}
      ${numberCell(0, 'Number', longestLeadTimeFormula)}
      ${numberCell(fourM?.productionCapacityPerWeek, 'NumberStrong')}
      ${numberCell(0, 'Number', '=R4C31+R4C32')}
      ${numberCell(0, 'CurrencyStrong', totalAdditionalCostFormula)}
      ${numberCell(0, 'CurrencyStrong', '=IF(R4C7>0,R4C15+(R4C35/R4C7),R4C15)')}
    </Row>
  `
}

const buildRawMaterialRows = (rawMaterials, rawStartRow) => {
  if (rawMaterials.length === 0) {
    return `
      <Row ss:Height="20">
        ${textCell('', 'Text')}
        ${textCell('No raw materials available', 'Text', null, 19)}
      </Row>
    `
  }

  return rawMaterials.map((rawRow, index) => {
    const row = mapRawMaterial(rawRow)
    const excelRow = rawStartRow + index

    return `
      <Row ss:Height="20">
        ${textCell('')}
        ${textCell(row.partReference, 'TextStrong')}
        ${textCell(row.referenceDesignation)}
        ${numberCell(row.quantityPerUnit, 'Number')}
        ${numberCell(row.totalRequirement, 'Number', row.totalRequirement ? null : `=R${excelRow}C4*R4C7`)}
        ${numberCell(row.rmCurrentStock, 'Number')}
        ${textCell(row.inventoryDateRm)}
        ${numberCell(row.rmStockAvailableForProd, 'Number')}
        ${numberCell(row.totalNeeds, 'Number', row.totalNeeds ? null : `=MAX(R${excelRow}C5-R${excelRow}C8,0)`)}
        ${numberCell(row.minimumOrderQuantity, 'Number')}
        ${numberCell(row.leadTimeWeeks, 'Number')}
        ${numberCell(row.currentPurchasePrice, 'Currency')}
        ${numberCell(row.lastPurchasePrice, 'Currency')}
        ${textCell(row.lastPurchasingDate)}
        ${numberCell(row.orderMultiplier, 'Number')}
        ${numberCell(0, 'Number', `=IF(R${excelRow}C10*R${excelRow}C15<R${excelRow}C9,R${excelRow}C9,R${excelRow}C10*R${excelRow}C15)`)}
        ${numberCell(
          row.quantityUnderOrder,
          'Number',
          row.quantityUnderOrder === '' || row.quantityUnderOrder === null || row.quantityUnderOrder === undefined
            ? `=IF(R${excelRow}C16<R${excelRow}C9,0,R${excelRow}C16-R${excelRow}C9)`
            : null,
        )}
        ${numberCell(0, 'Currency', `=R${excelRow}C17*R${excelRow}C12`)}
        ${numberCell(0, 'Currency', `=(R${excelRow}C12-R${excelRow}C13)*R${excelRow}C9`)}
        ${numberCell(0, 'CurrencyStrong', `=SUM(R${excelRow}C18:R${excelRow}C19)`)}
        ${textCell(row.needStudyCase)}
      </Row>
    `
  }).join('')
}

const buildPricingCalculatorBuffer = (ssr) => {
  const rawMaterials = getRawMaterials(ssr).map(mapRawMaterial)
  const rawStartRow = 7
  const rawEndRow = rawStartRow + Math.max(rawMaterials.length - 1, 0)
  const totalRow = rawMaterials.length > 0 ? rawEndRow + 1 : rawStartRow + 1
  const expandedRowCount = totalRow

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Pricing Calculator</Title>
  </DocumentProperties>
  <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
    <ProtectStructure>False</ProtectStructure>
    <ProtectWindows>False</ProtectWindows>
  </ExcelWorkbook>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="10"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1"/>
      <Interior ss:Color="#F97316" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Section">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#FCE7D6" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#111827" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Text">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="TextStrong">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:Bold="1"/>
    </Style>
    <Style ss:ID="Number">
      <NumberFormat ss:Format="0.00"/>
    </Style>
    <Style ss:ID="NumberStrong">
      <Font ss:Bold="1"/>
      <NumberFormat ss:Format="0.00"/>
    </Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="0.00"/>
    </Style>
    <Style ss:ID="CurrencyStrong">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
      <NumberFormat ss:Format="0.00"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="pricing calculator">
    <Table ss:ExpandedColumnCount="36" ss:ExpandedRowCount="${expandedRowCount}" x:FullColumns="1" x:FullRows="1">
      <Column ss:AutoFitWidth="0" ss:Width="140"/>
      <Column ss:AutoFitWidth="0" ss:Width="240"/>
      <Column ss:AutoFitWidth="0" ss:Width="120"/>
      <Column ss:AutoFitWidth="0" ss:Width="120"/>
      <Column ss:AutoFitWidth="0" ss:Width="120"/>
      <Column ss:AutoFitWidth="0" ss:Width="160"/>
      <Column ss:AutoFitWidth="0" ss:Width="100"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="130"/>
      <Column ss:AutoFitWidth="0" ss:Width="170"/>
      <Column ss:AutoFitWidth="0" ss:Width="170"/>
      <Column ss:AutoFitWidth="0" ss:Width="90"/>
      <Column ss:AutoFitWidth="0" ss:Width="100"/>
      <Column ss:AutoFitWidth="0" ss:Width="85"/>
      <Column ss:AutoFitWidth="0" ss:Width="150"/>
      <Column ss:AutoFitWidth="0" ss:Width="100"/>
      <Column ss:AutoFitWidth="0" ss:Width="85"/>
      <Column ss:AutoFitWidth="0" ss:Width="150"/>
      <Column ss:AutoFitWidth="0" ss:Width="100"/>
      <Column ss:AutoFitWidth="0" ss:Width="85"/>
      <Column ss:AutoFitWidth="0" ss:Width="150"/>
      <Column ss:AutoFitWidth="0" ss:Width="100"/>
      <Column ss:AutoFitWidth="0" ss:Width="100"/>
      <Column ss:AutoFitWidth="0" ss:Width="150"/>
      <Column ss:AutoFitWidth="0" ss:Width="100"/>
      <Column ss:AutoFitWidth="0" ss:Width="150"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>
      <Column ss:AutoFitWidth="0" ss:Width="110"/>

      <Row ss:Height="28">
        ${textCell('Pricing Calculator', 'Title', null, 35)}
      </Row>
      <Row ss:Height="22">
        ${textCell('Group Title', 'Section')}
      </Row>
      <Row ss:Height="24">
        ${textCell('Name', 'Header')}
        ${textCell('Subitems', 'Header')}
        ${textCell('Item ID', 'Header')}
        ${textCell('KAM', 'Header')}
        ${textCell('AVO Plant', 'Header')}
        ${textCell('Product Description', 'Header')}
        ${textCell('Quantity Requested', 'Header')}
        ${textCell('Estimated Date - Start', 'Header')}
        ${textCell('Estimated Date - End', 'Header')}
        ${textCell('Product Current Stock', 'Header')}
        ${textCell('Inventory_Date_FG', 'Header')}
        ${textCell('Product Stock Available for Sale', 'Header')}
        ${textCell('RM Availability Approval Documentations', 'Header')}
        ${textCell('Product Availability Approval Documentations', 'Header')}
        ${textCell('Last Selling price', 'Header')}
        ${textCell('Last Selling Date', 'Header')}
        ${textCell('Machine', 'Header')}
        ${textCell('Explanaition (machine)', 'Header')}
        ${textCell('Due Date (Machine)', 'Header')}
        ${textCell('Method', 'Header')}
        ${textCell('Explanaition (Method)', 'Header')}
        ${textCell('Due Date (Method)', 'Header')}
        ${textCell('Labor', 'Header')}
        ${textCell('Explanaition (Labor)', 'Header')}
        ${textCell('Due Date (Labor)', 'Header')}
        ${textCell('Environnement', 'Header')}
        ${textCell('Explanaition (Environnement)', 'Header')}
        ${textCell('Due Date (Environnement)', 'Header')}
        ${textCell('4M Approval Documentation', 'Header')}
        ${textCell('Production to launch', 'Header')}
        ${textCell('Production lead time', 'Header')}
        ${textCell('Longest component lead time in week', 'Header')}
        ${textCell('Production capacity per week', 'Header')}
        ${textCell('Total lead time', 'Header')}
        ${textCell('Sum of Additional Purshase cost', 'Header')}
        ${textCell('Minimum price to offer', 'Header')}
      </Row>
      ${buildSummaryRow(ssr, rawMaterials, rawStartRow, rawEndRow)}
      <Row ss:Height="18"/>
      <Row ss:Height="24">
        ${textCell('Subitems', 'Header')}
        ${textCell('Name', 'Header')}
        ${textCell('Reference Description', 'Header')}
        ${textCell('Quantity per Unit (Q,lien)', 'Header')}
        ${textCell('Total requirement', 'Header')}
        ${textCell('RM Current Stock', 'Header')}
        ${textCell('Inventory_Date_RM', 'Header')}
        ${textCell('RM Stock Available for Prod', 'Header')}
        ${textCell('Total Needs', 'Header')}
        ${textCell('Minimum Order Quantity', 'Header')}
        ${textCell('Lead time (week)', 'Header')}
        ${textCell('Current Purchase Price', 'Header')}
        ${textCell('Last Purchase Price', 'Header')}
        ${textCell('Last Purchasing Date', 'Header')}
        ${textCell('X MOQ to Order', 'Header')}
        ${textCell('Quantity Under Order', 'Header')}
        ${textCell('Excess Material', 'Header')}
        ${textCell('Cost of Excess material', 'Header')}
        ${textCell('Additional Purchase Cost', 'Header')}
        ${textCell('Total Additional Cost', 'Header')}
        ${textCell('Need study case', 'Header')}
      </Row>
      ${buildRawMaterialRows(rawMaterials, rawStartRow)}
      <Row ss:Height="22">
        ${textCell('')}
        ${textCell('Totals', 'Section', null, 17)}
        ${numberCell(0, 'CurrencyStrong', rawMaterials.length > 0 ? `=SUM(R${rawStartRow}C20:R${rawEndRow}C20)` : '=0')}
        ${textCell('')}
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`

  return Buffer.from(workbook, 'utf8')
}

module.exports = {
  buildPricingCalculatorBuffer,
}
