const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { getSalesRepDisplayName } = require('../utils/salesRep')

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const PAGE_MARGIN = 36
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2)
const FOOTER_HEIGHT = 28
const BRAND = {
  orange: [249, 115, 22],
  orangeSoft: [255, 244, 236],
  ink: [17, 24, 39],
  muted: [107, 114, 128],
  border: [229, 231, 235],
  panel: [249, 250, 251],
  white: [255, 255, 255],
}

const toPdfColor = ([r, g, b]) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`
const escapePdfText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')

const display = (value) => {
  if (value === undefined || value === null) return '-'
  const text = String(value).trim()
  return text || '-'
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString().slice(0, 10)
}

const formatStatus = (value) => {
  if (value === true) return 'OK'
  if (value === false) return 'NOK'
  return '-'
}

const getKamName = (ssr) => {
  const fullName = getSalesRepDisplayName(ssr?.kam)
  if (fullName) return fullName
  if (typeof ssr?.kam === 'string' && ssr.kam.trim()) return ssr.kam.trim()
  if (ssr?.kamName) return ssr.kamName
  if (ssr?.kam_id || ssr?.kamId) return `KAM #${ssr.kam_id || ssr.kamId}`
  return '-'
}

const getRawMaterials = (ssr) => {
  if (Array.isArray(ssr?.rawMaterials)) return ssr.rawMaterials
  if (Array.isArray(ssr?.stsForm?.rawMaterials)) return ssr.stsForm.rawMaterials
  return []
}

const estimateTextWidth = (text, fontSize, isBold = false) => {
  const factor = isBold ? 0.56 : 0.52
  return String(text || '').length * fontSize * factor
}

const wrapText = (text, maxWidth, fontSize, isBold = false) => {
  const normalized = String(text ?? '').trim()
  if (!normalized) return ['-']

  const words = normalized.split(/\s+/)
  const lines = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && estimateTextWidth(candidate, fontSize, isBold) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }

  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['-']
}

const readUInt32 = (buffer, offset) => buffer.readUInt32BE(offset)

const paethPredictor = (left, up, upLeft) => {
  const prediction = left + up - upLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const upLeftDistance = Math.abs(prediction - upLeft)
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left
  if (upDistance <= upLeftDistance) return up
  return upLeft
}

const parsePngImage = (filePath) => {
  const buffer = fs.readFileSync(filePath)
  const signature = buffer.slice(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('Unsupported PNG file')
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idatChunks = []

  while (offset < buffer.length) {
    const length = readUInt32(buffer, offset)
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii')
    const data = buffer.slice(offset + 8, offset + 8 + length)

    if (type === 'IHDR') {
      width = readUInt32(data, 0)
      height = readUInt32(data, 4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idatChunks.push(data)
    } else if (type === 'IEND') {
      break
    }

    offset += length + 12
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error('Unsupported PNG format')
  }

  const channels = colorType === 6 ? 4 : 3
  const bytesPerPixel = channels
  const stride = width * bytesPerPixel
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks))
  const raw = Buffer.alloc(width * height * bytesPerPixel)
  let sourceOffset = 0
  let targetOffset = 0

  for (let row = 0; row < height; row += 1) {
    const filterType = inflated[sourceOffset++]

    for (let column = 0; column < stride; column += 1) {
      const current = inflated[sourceOffset++]
      const left = column >= bytesPerPixel ? raw[targetOffset + column - bytesPerPixel] : 0
      const up = row > 0 ? raw[targetOffset + column - stride] : 0
      const upLeft = row > 0 && column >= bytesPerPixel ? raw[targetOffset + column - stride - bytesPerPixel] : 0

      let value = current
      if (filterType === 1) value = (current + left) & 0xFF
      if (filterType === 2) value = (current + up) & 0xFF
      if (filterType === 3) value = (current + Math.floor((left + up) / 2)) & 0xFF
      if (filterType === 4) value = (current + paethPredictor(left, up, upLeft)) & 0xFF

      raw[targetOffset + column] = value
    }

    targetOffset += stride
  }

  if (channels === 3) {
    return { width, height, rgb: raw, alpha: null }
  }

  const rgb = Buffer.alloc(width * height * 3)
  const alpha = Buffer.alloc(width * height)

  for (let index = 0, rgbIndex = 0, alphaIndex = 0; index < raw.length; index += 4, rgbIndex += 3, alphaIndex += 1) {
    rgb[rgbIndex] = raw[index]
    rgb[rgbIndex + 1] = raw[index + 1]
    rgb[rgbIndex + 2] = raw[index + 2]
    alpha[alphaIndex] = raw[index + 3]
  }

  return { width, height, rgb, alpha }
}

const loadLogoImage = () => {
  try {
    const logoPath = path.resolve(__dirname, '..', '..', 'frontend', 'public', 'img', 'logo.PNG')
    if (!fs.existsSync(logoPath)) return null
    return parsePngImage(logoPath)
  } catch (error) {
    console.warn('Unable to load PDF logo:', error.message)
    return null
  }
}

const createPdfReport = ({ ssr, submittedFormLabel, logoImage }) => {
  const pages = []
  const regularFontName = 'F1'
  const boldFontName = 'F2'
  let page = null
  let cursorY = PAGE_MARGIN

  const startPage = () => {
    page = { commands: [] }
    pages.push(page)
    cursorY = PAGE_MARGIN

    page.commands.push(
      `${toPdfColor(BRAND.orange)} rg 0 ${(PAGE_HEIGHT - 10).toFixed(2)} ${PAGE_WIDTH.toFixed(2)} 10 re f`,
      `${toPdfColor(BRAND.panel)} rg ${PAGE_MARGIN} ${(PAGE_HEIGHT - 112).toFixed(2)} ${CONTENT_WIDTH.toFixed(2)} 76 re f`,
      `${toPdfColor(BRAND.border)} RG 1 w ${PAGE_MARGIN} ${(PAGE_HEIGHT - 112).toFixed(2)} ${CONTENT_WIDTH.toFixed(2)} 76 re S`,
    )

    if (logoImage) {
      const maxWidth = 90
      const maxHeight = 48
      const ratio = Math.min(maxWidth / logoImage.width, maxHeight / logoImage.height)
      const width = logoImage.width * ratio
      const height = logoImage.height * ratio
      const x = PAGE_MARGIN + 12
      const top = PAGE_MARGIN + 14
      const y = PAGE_HEIGHT - top - height
      page.commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /ImLogo Do Q`)
    }

    const headerX = logoImage ? PAGE_MARGIN + 116 : PAGE_MARGIN + 18
    drawText('Submission Summary', headerX, PAGE_MARGIN + 16, { fontSize: 22, font: boldFontName, color: BRAND.ink })
    drawText(`Final report generated after ${display(submittedFormLabel)}`, headerX, PAGE_MARGIN + 44, { fontSize: 10, color: BRAND.muted })
    drawText(display(ssr?.productReference), PAGE_MARGIN + CONTENT_WIDTH - 160, PAGE_MARGIN + 18, { fontSize: 14, font: boldFontName, color: BRAND.orange, maxWidth: 140 })
    drawText(`Generated ${formatDate(new Date())}`, PAGE_MARGIN + CONTENT_WIDTH - 160, PAGE_MARGIN + 42, { fontSize: 9, color: BRAND.muted, maxWidth: 140 })

    cursorY = 130
  }

  const ensureSpace = (height) => {
    if (!page) startPage()
    if (cursorY + height + FOOTER_HEIGHT <= PAGE_HEIGHT - PAGE_MARGIN) return
    startPage()
  }

  const drawRect = (x, top, width, height, { fill = null, stroke = null, lineWidth = 1 } = {}) => {
    const y = PAGE_HEIGHT - top - height
    if (fill) page.commands.push(`${toPdfColor(fill)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`)
    if (stroke) page.commands.push(`${toPdfColor(stroke)} RG ${lineWidth} w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`)
  }

  const drawText = (text, x, top, {
    font = regularFontName,
    fontSize = 10,
    color = BRAND.ink,
    maxWidth = null,
    leading = null,
  } = {}) => {
    const lines = maxWidth ? wrapText(text, maxWidth, fontSize, font === boldFontName) : [display(text)]
    const lineHeight = leading || Math.max(fontSize + 3, 12)
    const startY = PAGE_HEIGHT - top - fontSize
    const textCommands = lines
      .map((line, index) => `${index === 0 ? '' : 'T* ' }(${escapePdfText(line)}) Tj`)
      .join('\n')

    page.commands.push(
      `BT\n/${font} ${fontSize} Tf\n${toPdfColor(color)} rg\n${x.toFixed(2)} ${startY.toFixed(2)} Td\n${lineHeight.toFixed(2)} TL\n${textCommands}\nET`,
    )

    return lines.length * lineHeight
  }

  const drawSectionHeader = (title, subtitle = '') => {
    ensureSpace(46)
    drawText(title, PAGE_MARGIN, cursorY, { fontSize: 15, font: boldFontName, color: BRAND.ink })
    if (subtitle) {
      drawText(subtitle, PAGE_MARGIN, cursorY + 18, { fontSize: 9, color: BRAND.muted, maxWidth: CONTENT_WIDTH })
    }
    page.commands.push(`${toPdfColor(BRAND.orange)} RG 1.2 w ${PAGE_MARGIN.toFixed(2)} ${(PAGE_HEIGHT - cursorY - 34).toFixed(2)} m ${(PAGE_MARGIN + 52).toFixed(2)} ${(PAGE_HEIGHT - cursorY - 34).toFixed(2)} l S`)
    cursorY += 48
  }

  const drawInfoGrid = (items, columns = 2) => {
    const gap = 12
    const cardWidth = (CONTENT_WIDTH - (gap * (columns - 1))) / columns

    for (let index = 0; index < items.length; index += columns) {
      const slice = items.slice(index, index + columns)
      const heights = slice.map((item) => {
        const valueLines = wrapText(display(item.value), cardWidth - 20, 10, false)
        return 18 + (valueLines.length * 13) + 16
      })
      const rowHeight = Math.max(...heights, 54)

      ensureSpace(rowHeight + 8)

      slice.forEach((item, columnIndex) => {
        const x = PAGE_MARGIN + (columnIndex * (cardWidth + gap))
        drawRect(x, cursorY, cardWidth, rowHeight, { fill: BRAND.white, stroke: BRAND.border })
        drawText(item.label, x + 10, cursorY + 10, { fontSize: 8, font: boldFontName, color: BRAND.orange, maxWidth: cardWidth - 20 })
        drawText(display(item.value), x + 10, cursorY + 24, { fontSize: 10, color: BRAND.ink, maxWidth: cardWidth - 20, leading: 13 })
      })

      cursorY += rowHeight + 8
    }
  }

  const drawRawMaterialCard = (row, index) => {
    const fields = [
      ['Designation', row.referenceDesignation || row.reference_designation || '-'],
      ['Quantity / Unit', row.quantityPerUnit || row.quantity_per_unit || '-'],
      ['Total Requirement', row.totalRequirement || row.total_requirement || '-'],
      ['RM Current Stock', row.rmCurrentStock || row.rm_current_stock || '-'],
      ['RM Available for Prod', row.rmAvailableForProd || row.rm_available_for_prod || '-'],
      ['Total Needs', row.totalNeeds || row.total_needs || '-'],
      ['Need Study Case', typeof row.needStudyCase === 'boolean' ? (row.needStudyCase ? 'Yes' : 'No') : (row.needStudyCase || row.need_study_case || '-')],
      ['Last Purchase Price', row.lastPurchasePrice || row.last_purchase_price || row.lastSellingPrice || '-'],
      ['MOQ', row.minimumOrderQuantity || row.minimum_order_quantity || '-'],
      ['X MOQ to Order', row.xMoqToOrder || row.orderMultiplier || '-'],
      ['Quantity Under Order', row.quantityUnderOrder || row.quantity_under_order || '-'],
      ['Lead Time (week)', row.leadTimeWeek || row.leadTimeWeeks || '-'],
      ['Supplier Price Proposal', row.supplierPriceProposal || row.currentPurchasePrice || row.current_purchase_price || '-'],
    ]

    const twoColumnWidth = (CONTENT_WIDTH - 24) / 2
    const fieldHeights = fields.map(([, value]) => 16 + (wrapText(display(value), twoColumnWidth - 20, 9).length * 12) + 10)
    const gridRows = Math.ceil(fields.length / 2)
    let gridHeight = 0
    for (let rowIndex = 0; rowIndex < gridRows; rowIndex += 1) {
      gridHeight += Math.max(fieldHeights[rowIndex * 2] || 0, fieldHeights[(rowIndex * 2) + 1] || 0) + 6
    }
    const titleHeight = 42
    const cardHeight = titleHeight + gridHeight + 8

    ensureSpace(cardHeight + 10)
    drawRect(PAGE_MARGIN, cursorY, CONTENT_WIDTH, cardHeight, { fill: BRAND.white, stroke: BRAND.border })
    drawRect(PAGE_MARGIN, cursorY, CONTENT_WIDTH, 34, { fill: BRAND.orangeSoft })
    drawText(`${index + 1}. ${display(row.partReference || row.part_reference)}`, PAGE_MARGIN + 12, cursorY + 10, { fontSize: 11, font: boldFontName, color: BRAND.ink, maxWidth: CONTENT_WIDTH - 24 })

    let localY = cursorY + titleHeight
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 2) {
      const pair = fields.slice(fieldIndex, fieldIndex + 2)
      const rowBoxHeight = Math.max(fieldHeights[fieldIndex] || 0, fieldHeights[fieldIndex + 1] || 0)

      pair.forEach(([label, value], pairIndex) => {
        const x = PAGE_MARGIN + 12 + (pairIndex * (twoColumnWidth + 12))
        drawRect(x, localY, twoColumnWidth, rowBoxHeight, { fill: BRAND.panel })
        drawText(label, x + 8, localY + 8, { fontSize: 7.5, font: boldFontName, color: BRAND.orange, maxWidth: twoColumnWidth - 16 })
        drawText(display(value), x + 8, localY + 20, { fontSize: 9, color: BRAND.ink, maxWidth: twoColumnWidth - 16, leading: 12 })
      })

      localY += rowBoxHeight + 6
    }

    cursorY += cardHeight + 10
  }

  startPage()

  drawSectionHeader('Overview', 'Key request information')
  drawInfoGrid([
    { label: 'SSR ID', value: ssr?.id },
    { label: 'Product Reference', value: ssr?.productReference },
    { label: 'Product Designation', value: ssr?.referenceDesignation || ssr?.productDesignation },
    { label: 'Customer', value: ssr?.customerName },
    { label: 'Plant', value: ssr?.plant || ssr?.avoPlant },
    { label: 'KAM', value: getKamName(ssr) },
    { label: 'Quantity Requested', value: ssr?.quantityRequested },
    { label: 'Date Requested', value: formatDate(ssr?.dateRequested) },
  ])

  drawSectionHeader('Form Summary', 'Consolidated values from the completed validation flow')
  drawInfoGrid([
    { label: 'Product Current Stock', value: ssr?.stsForm?.productCurrentStock },
    { label: 'Last Selling Price', value: ssr?.stsForm?.lastSellingPrice },
    { label: 'Last Selling Date', value: formatDate(ssr?.stsForm?.lastSellingDate) },
    { label: 'Product Available for Sale', value: ssr?.productInventoryValidation?.productAvailableForSale },
    { label: '4M Machine', value: formatStatus(ssr?.fourMValidation?.machineOk) },
    { label: '4M Method', value: formatStatus(ssr?.fourMValidation?.methodOk) },
    { label: '4M Labor', value: formatStatus(ssr?.fourMValidation?.laborOk) },
    { label: '4M Environment', value: formatStatus(ssr?.fourMValidation?.environmentOk) },
    { label: 'Production Capacity / Week', value: ssr?.fourMValidation?.productionCapacityPerWeek },
    { label: '4M Document', value: ssr?.fourMValidation?.documentName },
    { label: 'Product Inventory Document', value: ssr?.productInventoryValidation?.approvalDocumentName },
    { label: 'RM Availability Document', value: ssr?.rmAvailabilityValidation?.approvalDocumentName },
  ])

  const rawMaterials = getRawMaterials(ssr)
  drawSectionHeader('Raw Materials', rawMaterials.length > 0 ? `${rawMaterials.length} component(s) included in the summary` : 'No raw materials available')

  if (rawMaterials.length === 0) {
    drawInfoGrid([{ label: 'Status', value: 'No raw materials available.' }], 1)
  } else {
    rawMaterials.forEach(drawRawMaterialCard)
  }

  const addFooter = () => {
    pages.forEach((entry, index) => {
      entry.commands.push(
        `${toPdfColor(BRAND.border)} RG 1 w ${PAGE_MARGIN.toFixed(2)} ${FOOTER_HEIGHT.toFixed(2)} m ${(PAGE_WIDTH - PAGE_MARGIN).toFixed(2)} ${FOOTER_HEIGHT.toFixed(2)} l S`,
      )
      const footerLeft = `SSR ${display(ssr?.productReference)}`
      const footerRight = `Page ${index + 1} / ${pages.length}`
      const footerY = PAGE_HEIGHT - 22 - 9
      entry.commands.push(
        `BT\n/${regularFontName} 8 Tf\n${toPdfColor(BRAND.muted)} rg\n${PAGE_MARGIN.toFixed(2)} ${footerY.toFixed(2)} Td\n(${escapePdfText(footerLeft)}) Tj\nET`,
        `BT\n/${regularFontName} 8 Tf\n${toPdfColor(BRAND.muted)} rg\n${(PAGE_WIDTH - PAGE_MARGIN - 52).toFixed(2)} ${footerY.toFixed(2)} Td\n(${escapePdfText(footerRight)}) Tj\nET`,
      )
    })
  }

  addFooter()
  return pages
}

const buildPdfBufferFromPages = ({ pages, logoImage }) => {
  const objects = []
  let nextId = 1
  const catalogId = nextId++
  const pagesId = nextId++
  const regularFontId = nextId++
  const boldFontId = nextId++
  let softMaskId = null
  let imageId = null

  if (logoImage) {
    if (logoImage.alpha) softMaskId = nextId++
    imageId = nextId++
  }

  const pageIds = []

  objects[catalogId] = Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  objects[regularFontId] = Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  objects[boldFontId] = Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')

  if (logoImage) {
    if (softMaskId) {
      const alphaStream = zlib.deflateSync(logoImage.alpha)
      objects[softMaskId] = Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaStream.length} >>\nstream\n`),
        alphaStream,
        Buffer.from('\nendstream'),
      ])
    }

    const rgbStream = zlib.deflateSync(logoImage.rgb)
    const smask = softMaskId ? ` /SMask ${softMaskId} 0 R` : ''
    objects[imageId] = Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${rgbStream.length}${smask} >>\nstream\n`),
      rgbStream,
      Buffer.from('\nendstream'),
    ])
  }

  for (const entry of pages) {
    const contentId = nextId++
    const pageId = nextId++
    pageIds.push(pageId)

    const contentBuffer = Buffer.from(entry.commands.join('\n'))
    objects[contentId] = Buffer.concat([
      Buffer.from(`<< /Length ${contentBuffer.length} >>\nstream\n`),
      contentBuffer,
      Buffer.from('\nendstream'),
    ])

    const imageResource = imageId ? ` /XObject << /ImLogo ${imageId} 0 R >>` : ''
    objects[pageId] = Buffer.from(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >>${imageResource} >> /Contents ${contentId} 0 R >>`,
    )
  }

  objects[pagesId] = Buffer.from(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`)

  let pdf = Buffer.from('%PDF-1.4\n')
  const offsets = [0]

  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue
    offsets[id] = pdf.length
    pdf = Buffer.concat([pdf, Buffer.from(`${id} 0 obj\n`), objects[id], Buffer.from('\nendobj\n')])
  }

  const xrefOffset = pdf.length
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id += 1) {
    xref += `${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`
  }

  const trailer = `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.concat([pdf, Buffer.from(xref), Buffer.from(trailer)])
}

const buildSubmissionSummaryPdfBuffer = ({ ssr, submittedFormLabel }) => {
  const logoImage = loadLogoImage()
  const pages = createPdfReport({ ssr, submittedFormLabel, logoImage })
  return buildPdfBufferFromPages({ pages, logoImage })
}

module.exports = {
  buildSubmissionSummaryPdfBuffer,
}
