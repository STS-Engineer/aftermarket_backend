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
    orderMultiplier: pickFirst(row, ['orderMultiplier', 'xMoqToOrder', 'xMOQToOrder', 'xMoq', 'multiplier']),
    quantityUnderOrder: pickFirst(row, ['quantityUnderOrder', 'quantity_under_order', 'orderedQuantity', 'ordered_quantity', 'qtyUnderOrder']),
    needStudyCase: typeof rawNeedStudyCase === 'boolean'
      ? (rawNeedStudyCase ? 'yes' : 'no')
      : rawNeedStudyCase,
  }
}

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const XLSX_SHEET_NAME = 'pricing calculator'
const XLSX_COLUMN_WIDTHS = [
  18, 30, 16, 16, 16, 24, 16, 18, 18, 18, 18, 24,
  28, 28, 16, 18, 14, 26, 18, 14, 26, 18, 14, 26,
  18, 14, 26, 18, 28, 18, 18, 20, 18, 18, 20, 20,
]
const XLSX_STYLE = Object.freeze({
  default: 0,
  title: 1,
  section: 2,
  header: 3,
  text: 4,
  textStrong: 5,
  number: 6,
  numberStrong: 7,
  currency: 8,
  currencyStrong: 9,
})

const toExcelColumnName = (index) => {
  let value = index
  let columnName = ''

  while (value > 0) {
    const remainder = (value - 1) % 26
    columnName = String.fromCharCode(65 + remainder) + columnName
    value = Math.floor((value - 1) / 26)
  }

  return columnName
}

const toExcelCellRef = (rowNumber, columnIndex) => `${toExcelColumnName(columnIndex)}${rowNumber}`

const getInlineStringCellXml = (ref, value, styleId = XLSX_STYLE.text) => {
  const normalized = value === null || value === undefined ? '' : String(value)
  return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(normalized)}</t></is></c>`
}

const getNumberCellXml = (ref, value, styleId = XLSX_STYLE.number) => {
  const numericValue = toFiniteNumber(value)

  if (numericValue === null) {
    return getInlineStringCellXml(ref, '', styleId)
  }

  return `<c r="${ref}" s="${styleId}"><v>${numericValue}</v></c>`
}

const getFormulaCellXml = (ref, formula, styleId = XLSX_STYLE.number, cachedValue = null) => {
  const cachedNumericValue = toFiniteNumber(cachedValue)
  const valueXml = cachedNumericValue === null ? '' : `<v>${cachedNumericValue}</v>`
  return `<c r="${ref}" s="${styleId}"><f>${escapeXml(formula)}</f>${valueXml}</c>`
}

const getTextOrNumberCellXml = (ref, value, textStyleId = XLSX_STYLE.text, numberStyleId = XLSX_STYLE.number) => {
  const numericValue = toFiniteNumber(value)
  return numericValue === null
    ? getInlineStringCellXml(ref, value, textStyleId)
    : getNumberCellXml(ref, numericValue, numberStyleId)
}

const getRowXml = (rowNumber, cells, height = null) => {
  const heightXml = height ? ` ht="${height}" customHeight="1"` : ''
  return `<row r="${rowNumber}"${heightXml}>${cells.join('')}</row>`
}

const getColsXml = () => XLSX_COLUMN_WIDTHS
  .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
  .join('')

const getContentTypesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`

const getRootRelsXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

const getAppXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Excel</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>${escapeXml(XLSX_SHEET_NAME)}</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company>AVO Carbon</Company>
</Properties>`

const getCoreXml = () => {
  const createdAt = new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Pricing Calculator</dc:title>
  <dc:creator>AVO Carbon</dc:creator>
  <cp:lastModifiedBy>AVO Carbon</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
</cp:coreProperties>`
}

const getWorkbookXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <fileVersion appName="xl"/>
  <workbookPr defaultThemeVersion="166925"/>
  <bookViews>
    <workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15360"/>
  </bookViews>
  <sheets>
    <sheet name="${escapeXml(XLSX_SHEET_NAME)}" sheetId="1" r:id="rId1"/>
  </sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>
</workbook>`

const getWorkbookRelsXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

const getStylesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="10"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF97316"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFCE7D6"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF111827"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border>
      <left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/>
    </border>
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="4" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="4" fontId="3" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index += 1) {
    let value = index

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1
        ? (0xEDB88320 ^ (value >>> 1))
        : (value >>> 1)
    }

    table[index] = value >>> 0
  }

  return table
})()

const getCrc32 = (buffer) => {
  let crc = 0xFFFFFFFF

  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  }

  return (crc ^ 0xFFFFFFFF) >>> 0
}

const getDosDateTime = (value = new Date()) => {
  const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date()
  const year = Math.max(date.getFullYear(), 1980)

  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

const buildZipBuffer = (entries) => {
  const fileChunks = []
  const centralDirectoryChunks = []
  let currentOffset = 0
  const { time, date } = getDosDateTime()

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8')
    const dataBuffer = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, 'utf8')
    const crc32 = getCrc32(dataBuffer)

    const localHeader = Buffer.alloc(30 + nameBuffer.length)
    localHeader.writeUInt32LE(0x04034B50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(time, 10)
    localHeader.writeUInt16LE(date, 12)
    localHeader.writeUInt32LE(crc32, 14)
    localHeader.writeUInt32LE(dataBuffer.length, 18)
    localHeader.writeUInt32LE(dataBuffer.length, 22)
    localHeader.writeUInt16LE(nameBuffer.length, 26)
    localHeader.writeUInt16LE(0, 28)
    nameBuffer.copy(localHeader, 30)

    const centralHeader = Buffer.alloc(46 + nameBuffer.length)
    centralHeader.writeUInt32LE(0x02014B50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(time, 12)
    centralHeader.writeUInt16LE(date, 14)
    centralHeader.writeUInt32LE(crc32, 16)
    centralHeader.writeUInt32LE(dataBuffer.length, 20)
    centralHeader.writeUInt32LE(dataBuffer.length, 24)
    centralHeader.writeUInt16LE(nameBuffer.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(currentOffset, 42)
    nameBuffer.copy(centralHeader, 46)

    fileChunks.push(localHeader, dataBuffer)
    centralDirectoryChunks.push(centralHeader)
    currentOffset += localHeader.length + dataBuffer.length
  }

  const centralDirectorySize = centralDirectoryChunks.reduce((total, chunk) => total + chunk.length, 0)
  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(0x06054B50, 0)
  endOfCentralDirectory.writeUInt16LE(0, 4)
  endOfCentralDirectory.writeUInt16LE(0, 6)
  endOfCentralDirectory.writeUInt16LE(entries.length, 8)
  endOfCentralDirectory.writeUInt16LE(entries.length, 10)
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12)
  endOfCentralDirectory.writeUInt32LE(currentOffset, 16)
  endOfCentralDirectory.writeUInt16LE(0, 20)

  return Buffer.concat([
    ...fileChunks,
    ...centralDirectoryChunks,
    endOfCentralDirectory,
  ])
}

const getSummaryHeaders = () => ([
  'Name',
  'Subitems',
  'Item ID',
  'KAM',
  'AVO Plant',
  'Product Description',
  'Quantity Requested',
  'Estimated Date - Start',
  'Estimated Date - End',
  'Product Current Stock',
  'Inventory_Date_FG',
  'Product Stock Available for Sale',
  'RM Availability Approval Documentations',
  'Product Availability Approval Documentations',
  'Last Selling price',
  'Last Selling Date',
  'Machine',
  'Explanaition (machine)',
  'Due Date (Machine)',
  'Method',
  'Explanaition (Method)',
  'Due Date (Method)',
  'Labor',
  'Explanaition (Labor)',
  'Due Date (Labor)',
  'Environnement',
  'Explanaition (Environnement)',
  'Due Date (Environnement)',
  '4M Approval Documentation',
  'Production to launch',
  'Production lead time',
  'Longest component lead time in week',
  'Production capacity per week',
  'Total lead time',
  'Sum of Additional Purshase cost',
  'Minimum price to offer',
])

const getRawMaterialHeaders = () => ([
  'Subitems',
  'Name',
  'Reference Description',
  'Quantity per Unit (Q,lien)',
  'Total requirement',
  'RM Current Stock',
  'Inventory_Date_RM',
  'RM Stock Available for Prod',
  'Total Needs',
  'Minimum Order Quantity',
  'Lead time (week)',
  'Current Purchase Price',
  'Last Purchase Price',
  'Last Purchasing Date',
  'X MOQ to Order',
  'Quantity Under Order',
  'Excess Material',
  'Cost of Excess material',
  'Additional Purchase Cost',
  'Total Additional Cost',
  'Need study case',
])

const getWorksheetXml = (ssr) => {
  const rawMaterials = getRawMaterials(ssr).map(mapRawMaterial)
  const rawStartRow = 7
  const rawEndRow = rawMaterials.length > 0 ? rawStartRow + rawMaterials.length - 1 : rawStartRow
  const totalRow = rawMaterials.length > 0 ? rawEndRow + 1 : rawStartRow + 1
  const lastRow = totalRow
  const rows = []

  rows.push(getRowXml(1, [
    getInlineStringCellXml('A1', 'Pricing Calculator', XLSX_STYLE.title),
  ], 26))

  rows.push(getRowXml(2, [
    getInlineStringCellXml('A2', 'Group Title', XLSX_STYLE.section),
  ], 20))

  rows.push(getRowXml(3, getSummaryHeaders().map((header, index) => (
    getInlineStringCellXml(toExcelCellRef(3, index + 1), header, XLSX_STYLE.header)
  )), 34))

  const fourM = ssr?.fourMValidation || {}
  const sts = ssr?.stsForm || {}
  const productInventory = ssr?.productInventoryValidation || {}
  const rmAvailability = ssr?.rmAvailabilityValidation || {}
  const rawReferences = rawMaterials.map((row) => row.partReference).filter(Boolean).join(', ')
  const fgInventoryDate = formatDate(productInventory.updatedAt || productInventory.createdAt)

  rows.push(getRowXml(4, [
    getInlineStringCellXml('A4', ssr?.productReference || '', XLSX_STYLE.textStrong),
    getInlineStringCellXml('B4', rawReferences, XLSX_STYLE.text),
    getNumberCellXml('C4', ssr?.id, XLSX_STYLE.number),
    getInlineStringCellXml('D4', getKamName(ssr), XLSX_STYLE.text),
    getInlineStringCellXml('E4', ssr?.plant || ssr?.avoPlant || '', XLSX_STYLE.text),
    getInlineStringCellXml('F4', ssr?.referenceDesignation || ssr?.productDesignation || '', XLSX_STYLE.text),
    getNumberCellXml('G4', ssr?.quantityRequested, XLSX_STYLE.numberStrong),
    getInlineStringCellXml('H4', formatDate(ssr?.dateRequested), XLSX_STYLE.text),
    getInlineStringCellXml('I4', '', XLSX_STYLE.text),
    getTextOrNumberCellXml('J4', sts?.productCurrentStock, XLSX_STYLE.text, XLSX_STYLE.number),
    getInlineStringCellXml('K4', fgInventoryDate, XLSX_STYLE.text),
    getInlineStringCellXml('L4', productInventory?.productAvailableForSale || '', XLSX_STYLE.text),
    getInlineStringCellXml('M4', rmAvailability?.approvalDocumentPath || rmAvailability?.approvalDocumentName || '', XLSX_STYLE.text),
    getInlineStringCellXml('N4', productInventory?.approvalDocumentPath || productInventory?.approvalDocumentName || '', XLSX_STYLE.text),
    getTextOrNumberCellXml('O4', sts?.lastSellingPrice, XLSX_STYLE.text, XLSX_STYLE.currency),
    getInlineStringCellXml('P4', formatDate(sts?.lastSellingDate), XLSX_STYLE.text),
    getInlineStringCellXml('Q4', formatBooleanStatus(fourM?.machineOk), XLSX_STYLE.text),
    getInlineStringCellXml('R4', fourM?.machineExplanation || '', XLSX_STYLE.text),
    getInlineStringCellXml('S4', formatDate(fourM?.machineDueDate), XLSX_STYLE.text),
    getInlineStringCellXml('T4', formatBooleanStatus(fourM?.methodOk), XLSX_STYLE.text),
    getInlineStringCellXml('U4', fourM?.methodExplanation || '', XLSX_STYLE.text),
    getInlineStringCellXml('V4', formatDate(fourM?.methodDueDate), XLSX_STYLE.text),
    getInlineStringCellXml('W4', formatBooleanStatus(fourM?.laborOk), XLSX_STYLE.text),
    getInlineStringCellXml('X4', fourM?.laborExplanation || '', XLSX_STYLE.text),
    getInlineStringCellXml('Y4', formatDate(fourM?.laborDueDate), XLSX_STYLE.text),
    getInlineStringCellXml('Z4', formatBooleanStatus(fourM?.environmentOk), XLSX_STYLE.text),
    getInlineStringCellXml('AA4', fourM?.environmentExplanation || '', XLSX_STYLE.text),
    getInlineStringCellXml('AB4', formatDate(fourM?.environmentDueDate), XLSX_STYLE.text),
    getInlineStringCellXml('AC4', fourM?.documentPath || fourM?.documentName || '', XLSX_STYLE.text),
    getFormulaCellXml('AD4', 'IF(COUNT(G4,J4)<2,"",MAX(G4-J4,0))', XLSX_STYLE.number),
    getFormulaCellXml('AE4', 'IF(COUNT(AD4,AG4)<2,"",IF(AG4>0,ROUNDUP(AD4/AG4,0),""))', XLSX_STYLE.number),
    getFormulaCellXml('AF4', `IF(COUNTA(K${rawStartRow}:K${rawEndRow})=0,"",MAX(K${rawStartRow}:K${rawEndRow}))`, XLSX_STYLE.number),
    getNumberCellXml('AG4', fourM?.productionCapacityPerWeek, XLSX_STYLE.numberStrong),
    getFormulaCellXml('AH4', 'IF(COUNT(AE4,AF4)<2,"",AE4+AF4)', XLSX_STYLE.number),
    getFormulaCellXml('AI4', `IF(COUNTA(T${rawStartRow}:T${rawEndRow})=0,"",SUM(T${rawStartRow}:T${rawEndRow}))`, XLSX_STYLE.currencyStrong),
    getFormulaCellXml('AJ4', 'IF(COUNT(G4,O4,AI4)<3,"",IF(G4=0,"",O4+(AI4/G4)))', XLSX_STYLE.currencyStrong),
  ], 22))

  rows.push(getRowXml(5, [], 10))
  rows.push(getRowXml(6, getRawMaterialHeaders().map((header, index) => (
    getInlineStringCellXml(toExcelCellRef(6, index + 1), header, XLSX_STYLE.header)
  )), 34))

  if (rawMaterials.length === 0) {
    rows.push(getRowXml(7, [
      getInlineStringCellXml('A7', '', XLSX_STYLE.text),
      getInlineStringCellXml('B7', 'No raw materials available', XLSX_STYLE.text),
    ], 20))
  } else {
    rawMaterials.forEach((rawMaterial, index) => {
      const rowNumber = rawStartRow + index
      const totalRequirementValue = toFiniteNumber(rawMaterial.totalRequirement)
      const totalNeedsValue = toFiniteNumber(rawMaterial.totalNeeds)
      const quantityUnderOrderValue = toFiniteNumber(rawMaterial.quantityUnderOrder)

      rows.push(getRowXml(rowNumber, [
        getInlineStringCellXml(`A${rowNumber}`, '', XLSX_STYLE.text),
        getInlineStringCellXml(`B${rowNumber}`, rawMaterial.partReference, XLSX_STYLE.textStrong),
        getInlineStringCellXml(`C${rowNumber}`, rawMaterial.referenceDesignation, XLSX_STYLE.text),
        getTextOrNumberCellXml(`D${rowNumber}`, rawMaterial.quantityPerUnit, XLSX_STYLE.text, XLSX_STYLE.number),
        totalRequirementValue === null
          ? getFormulaCellXml(`E${rowNumber}`, `IF(COUNT(D${rowNumber},$G$4)<2,"",D${rowNumber}*$G$4)`, XLSX_STYLE.number)
          : getNumberCellXml(`E${rowNumber}`, totalRequirementValue, XLSX_STYLE.number),
        getTextOrNumberCellXml(`F${rowNumber}`, rawMaterial.rmCurrentStock, XLSX_STYLE.text, XLSX_STYLE.number),
        getInlineStringCellXml(`G${rowNumber}`, rawMaterial.inventoryDateRm, XLSX_STYLE.text),
        getTextOrNumberCellXml(`H${rowNumber}`, rawMaterial.rmStockAvailableForProd, XLSX_STYLE.text, XLSX_STYLE.number),
        totalNeedsValue === null
          ? getFormulaCellXml(`I${rowNumber}`, `IF(COUNT(E${rowNumber},H${rowNumber})<2,"",MAX(E${rowNumber}-H${rowNumber},0))`, XLSX_STYLE.number)
          : getNumberCellXml(`I${rowNumber}`, totalNeedsValue, XLSX_STYLE.number),
        getTextOrNumberCellXml(`J${rowNumber}`, rawMaterial.minimumOrderQuantity, XLSX_STYLE.text, XLSX_STYLE.number),
        getTextOrNumberCellXml(`K${rowNumber}`, rawMaterial.leadTimeWeeks, XLSX_STYLE.text, XLSX_STYLE.number),
        getTextOrNumberCellXml(`L${rowNumber}`, rawMaterial.currentPurchasePrice, XLSX_STYLE.text, XLSX_STYLE.currency),
        getTextOrNumberCellXml(`M${rowNumber}`, rawMaterial.lastPurchasePrice, XLSX_STYLE.text, XLSX_STYLE.currency),
        getInlineStringCellXml(`N${rowNumber}`, rawMaterial.lastPurchasingDate, XLSX_STYLE.text),
        getTextOrNumberCellXml(`O${rowNumber}`, rawMaterial.orderMultiplier, XLSX_STYLE.text, XLSX_STYLE.number),
        quantityUnderOrderValue === null
          ? getFormulaCellXml(`P${rowNumber}`, `IF(COUNT(J${rowNumber},O${rowNumber},I${rowNumber})<3,"",IF(J${rowNumber}*O${rowNumber}<I${rowNumber},I${rowNumber},J${rowNumber}*O${rowNumber}))`, XLSX_STYLE.number)
          : getNumberCellXml(`P${rowNumber}`, quantityUnderOrderValue, XLSX_STYLE.number),
        getFormulaCellXml(`Q${rowNumber}`, `IF(COUNT(P${rowNumber},I${rowNumber})<2,"",IF(P${rowNumber}<I${rowNumber},0,P${rowNumber}-I${rowNumber}))`, XLSX_STYLE.number),
        getFormulaCellXml(`R${rowNumber}`, `IF(COUNT(Q${rowNumber},L${rowNumber})<2,"",Q${rowNumber}*L${rowNumber})`, XLSX_STYLE.currency),
        getFormulaCellXml(`S${rowNumber}`, `IF(COUNT(L${rowNumber},M${rowNumber},I${rowNumber})<3,"",(L${rowNumber}-M${rowNumber})*I${rowNumber})`, XLSX_STYLE.currency),
        getFormulaCellXml(`T${rowNumber}`, `IF(COUNTA(R${rowNumber}:S${rowNumber})=0,"",SUM(R${rowNumber}:S${rowNumber}))`, XLSX_STYLE.currencyStrong),
        getInlineStringCellXml(`U${rowNumber}`, rawMaterial.needStudyCase, XLSX_STYLE.text),
      ], 20))
    })
  }

  rows.push(getRowXml(totalRow, [
    getInlineStringCellXml(`B${totalRow}`, 'Totals', XLSX_STYLE.section),
    getFormulaCellXml(`T${totalRow}`, `IF(COUNTA(T${rawStartRow}:T${rawEndRow})=0,"",SUM(T${rawStartRow}:T${rawEndRow}))`, XLSX_STYLE.currencyStrong),
  ], 22))

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:AJ${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${getColsXml()}</cols>
  <sheetData>${rows.join('')}</sheetData>
  <mergeCells count="1"><mergeCell ref="A1:AJ1"/></mergeCells>
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`
}

const buildPricingCalculatorXlsxBuffer = (ssr) => buildZipBuffer([
  { name: '[Content_Types].xml', content: getContentTypesXml() },
  { name: '_rels/.rels', content: getRootRelsXml() },
  { name: 'docProps/app.xml', content: getAppXml() },
  { name: 'docProps/core.xml', content: getCoreXml() },
  { name: 'xl/workbook.xml', content: getWorkbookXml() },
  { name: 'xl/_rels/workbook.xml.rels', content: getWorkbookRelsXml() },
  { name: 'xl/styles.xml', content: getStylesXml() },
  { name: 'xl/worksheets/sheet1.xml', content: getWorksheetXml(ssr) },
])

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
        ${numberCell(
          row.quantityUnderOrder,
          'Number',
          row.quantityUnderOrder === '' || row.quantityUnderOrder === null || row.quantityUnderOrder === undefined
            ? `=IF(R${excelRow}C10*R${excelRow}C15<R${excelRow}C9,R${excelRow}C9,R${excelRow}C10*R${excelRow}C15)`
            : null,
        )}
        ${numberCell(0, 'Number', `=IF(R${excelRow}C16<R${excelRow}C9,0,R${excelRow}C16-R${excelRow}C9)`)}
        ${numberCell(0, 'Currency', `=R${excelRow}C17*R${excelRow}C12`)}
        ${numberCell(0, 'Currency', `=(R${excelRow}C12-R${excelRow}C13)*R${excelRow}C9`)}
        ${numberCell(0, 'CurrencyStrong', `=SUM(R${excelRow}C18:R${excelRow}C19)`)}
        ${textCell(row.needStudyCase)}
      </Row>
    `
  }).join('')
}

const buildLegacyPricingCalculatorBuffer = (ssr) => {
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

const buildPricingCalculatorBuffer = (ssr) => buildPricingCalculatorXlsxBuffer(ssr)

module.exports = {
  XLSX_CONTENT_TYPE,
  buildPricingCalculatorBuffer,
  buildLegacyPricingCalculatorBuffer,
}
