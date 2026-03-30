const { transporter } = require('./mailTransport')

const RECENT_EMAIL_WINDOW_MS = 5 * 60 * 1000
const recentEmailKeys = new Map()

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const getSummaryRecipients = () => {
  const seenEmails = new Set()

  return [
    { key: 'hamdi', name: process.env.HAMDI_NAME || 'Hamdi', email: process.env.HAMDI_EMAIL },
    { key: 'aziza', name: process.env.AZIZA_NAME || 'Aziza', email: process.env.AZIZA_EMAIL },
  ].filter((recipient) => {
    const normalizedEmail = normalizeEmail(recipient.email)
    if (!normalizedEmail || seenEmails.has(normalizedEmail)) return false
    seenEmails.add(normalizedEmail)
    return true
  })
}

const sendMailOnce = async ({ dedupeKey, mailOptions, windowMs = RECENT_EMAIL_WINDOW_MS }) => {
  const now = Date.now()

  for (const [key, timestamp] of recentEmailKeys.entries()) {
    if (now - timestamp > windowMs) {
      recentEmailKeys.delete(key)
    }
  }

  if (dedupeKey && recentEmailKeys.has(dedupeKey)) {
    console.warn(`Skipping duplicate summary email send for key: ${dedupeKey}`)
    return null
  }

  if (dedupeKey) {
    recentEmailKeys.set(dedupeKey, now)
  }

  try {
    return await transporter.sendMail(mailOptions)
  } catch (error) {
    if (dedupeKey) {
      recentEmailKeys.delete(dedupeKey)
    }

    throw error
  }
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const escapePdfText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')

const formatDate = (value) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toISOString().slice(0, 10)
}

const formatBooleanStatus = (value) => {
  if (value === true) return 'OK'
  if (value === false) return 'NOK'
  return '-'
}

const getKamName = (ssr) => {
  if (ssr?.kam && typeof ssr.kam === 'object') {
    const fullName = [ssr.kam.first_name, ssr.kam.last_name].filter(Boolean).join(' ').trim()
    if (fullName) return fullName
  }

  if (typeof ssr?.kam === 'string' && ssr.kam.trim()) {
    return ssr.kam.trim()
  }

  if (ssr?.kamName) {
    return ssr.kamName
  }

  if (ssr?.kam_id || ssr?.kamId) {
    return `KAM #${ssr.kam_id || ssr.kamId}`
  }

  return '-'
}

const getRawMaterials = (ssr) => {
  if (Array.isArray(ssr?.stsForm?.rawMaterials)) return ssr.stsForm.rawMaterials
  if (Array.isArray(ssr?.rawMaterials)) return ssr.rawMaterials
  return []
}

const collectSummaryEntries = (ssr) => {
  const entries = [
    { section: 'SSR', field: 'SSR ID', value: ssr?.id ?? '-' },
    { section: 'SSR', field: 'Product Reference', value: ssr?.productReference || '-' },
    { section: 'SSR', field: 'Product Designation', value: ssr?.referenceDesignation || ssr?.productDesignation || '-' },
    { section: 'SSR', field: 'Product Family', value: ssr?.productFamily || '-' },
    { section: 'SSR', field: 'Customer Name', value: ssr?.customerName || '-' },
    { section: 'SSR', field: 'KAM', value: getKamName(ssr) },
    { section: 'SSR', field: 'Plant', value: ssr?.plant || ssr?.avoPlant || '-' },
    { section: 'SSR', field: 'Quantity Requested', value: ssr?.quantityRequested ?? '-' },
    { section: 'SSR', field: 'Date Requested', value: formatDate(ssr?.dateRequested) },
    { section: 'SSR', field: 'KAM Note', value: ssr?.kamNote || '-' },
    { section: 'SSR', field: 'Created At', value: formatDate(ssr?.createdAt) },
  ]

  const fourM = ssr?.fourMValidation
  entries.push(
    { section: '4M Validation', field: 'Machine', value: formatBooleanStatus(fourM?.machineOk) },
    { section: '4M Validation', field: 'Machine Explanation', value: fourM?.machineExplanation || '-' },
    { section: '4M Validation', field: 'Machine Due Date', value: formatDate(fourM?.machineDueDate) },
    { section: '4M Validation', field: 'Method', value: formatBooleanStatus(fourM?.methodOk) },
    { section: '4M Validation', field: 'Method Explanation', value: fourM?.methodExplanation || '-' },
    { section: '4M Validation', field: 'Method Due Date', value: formatDate(fourM?.methodDueDate) },
    { section: '4M Validation', field: 'Labor', value: formatBooleanStatus(fourM?.laborOk) },
    { section: '4M Validation', field: 'Labor Explanation', value: fourM?.laborExplanation || '-' },
    { section: '4M Validation', field: 'Labor Due Date', value: formatDate(fourM?.laborDueDate) },
    { section: '4M Validation', field: 'Environment', value: formatBooleanStatus(fourM?.environmentOk) },
    { section: '4M Validation', field: 'Environment Explanation', value: fourM?.environmentExplanation || '-' },
    { section: '4M Validation', field: 'Environment Due Date', value: formatDate(fourM?.environmentDueDate) },
    { section: '4M Validation', field: 'Production Capacity / Week', value: fourM?.productionCapacityPerWeek ?? '-' },
    { section: '4M Validation', field: 'Document', value: fourM?.documentName || '-' },
  )

  const sts = ssr?.stsForm
  entries.push(
    { section: 'STS Form', field: 'Product Current Stock', value: sts?.productCurrentStock || '-' },
    { section: 'STS Form', field: 'Last Selling Price', value: sts?.lastSellingPrice || '-' },
    { section: 'STS Form', field: 'Last Selling Date', value: formatDate(sts?.lastSellingDate) },
    { section: 'STS Form', field: 'Status 1', value: sts?.status1 || ssr?.status1 || '-' },
  )

  const productInventory = ssr?.productInventoryValidation
  entries.push(
    { section: 'Product Inventory Validation', field: 'Product Available For Sale', value: productInventory?.productAvailableForSale || '-' },
    { section: 'Product Inventory Validation', field: 'Approval Document', value: productInventory?.approvalDocumentName || '-' },
  )

  const rmAvailability = ssr?.rmAvailabilityValidation
  entries.push(
    { section: 'RM Availability Validation', field: 'Approval Document', value: rmAvailability?.approvalDocumentName || '-' },
  )

  return entries
}

const wrapLine = (value, maxLength = 95) => {
  const text = String(value || '')
  if (text.length <= maxLength) return [text]

  const parts = []
  let remaining = text

  while (remaining.length > maxLength) {
    let splitIndex = remaining.lastIndexOf(' ', maxLength)
    if (splitIndex <= 0) splitIndex = maxLength
    parts.push(remaining.slice(0, splitIndex))
    remaining = remaining.slice(splitIndex).trimStart()
  }

  if (remaining) {
    parts.push(remaining)
  }

  return parts
}

const buildPdfBuffer = (ssr, submittedFormLabel) => {
  const entries = collectSummaryEntries(ssr)
  const rawMaterials = getRawMaterials(ssr)
  const lines = [
    `SSR Summary - ${submittedFormLabel}`,
    `Product Reference: ${ssr?.productReference || '-'}`,
    `Generated At: ${new Date().toISOString()}`,
    '',
  ]

  for (const entry of entries) {
    const label = `[${entry.section}] ${entry.field}: ${entry.value}`
    lines.push(...wrapLine(label))
  }

  lines.push('')
  lines.push('Raw Materials')

  if (rawMaterials.length === 0) {
    lines.push('No raw materials available.')
  } else {
    rawMaterials.forEach((row, index) => {
      lines.push(...wrapLine(
        `${index + 1}. Part Reference: ${row.partReference || '-'} | Designation: ${row.referenceDesignation || '-'} | Quantity per Unit: ${row.quantityPerUnit || '-'} | RM Current Stock: ${row.rmCurrentStock || '-'} | Last Purchase Price: ${row.lastPurchasePrice || '-'}`,
      ))
    })
  }

  const pageLineCount = 42
  const pages = []
  for (let index = 0; index < lines.length; index += pageLineCount) {
    pages.push(lines.slice(index, index + pageLineCount))
  }

  const fontId = 3 + (pages.length * 2)
  const objects = new Array(fontId + 1).fill(null)
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'

  const pageRefs = []
  let objectId = 3

  pages.forEach((pageLines) => {
    const pageId = objectId++
    const contentId = objectId++
    pageRefs.push(`${pageId} 0 R`)

    const textCommands = pageLines
      .map((line, index) => `${index === 0 ? '' : 'T* ' }(${escapePdfText(line)}) Tj`)
      .join('\n')

    const content = `BT\n/F1 10 Tf\n50 750 Td\n14 TL\n${textCommands}\nET`
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    objects[contentId] = `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`
  })

  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.join(' ')}] >>`
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, 'utf8')
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length}\n`
  pdf += '0000000000 65535 f \n'

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, 'utf8')
}

const buildExcelBuffer = (ssr, submittedFormLabel) => {
  const entries = collectSummaryEntries(ssr)
  const rawMaterials = getRawMaterials(ssr)

  const summaryRows = entries.map((entry) => `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(entry.section)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(entry.field)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(entry.value)}</Data></Cell>
      </Row>
  `).join('')

  const rawMaterialRows = rawMaterials.length > 0
    ? rawMaterials.map((row, index) => `
      <Row>
        <Cell><Data ss:Type="Number">${index + 1}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(row.partReference || '')}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(row.referenceDesignation || '')}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(row.quantityPerUnit || '')}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(row.rmCurrentStock || '')}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(row.lastPurchasePrice || '')}</Data></Cell>
      </Row>
    `).join('')
    : `
      <Row>
        <Cell><Data ss:Type="String">No raw materials available</Data></Cell>
      </Row>
    `

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Worksheet ss:Name="SSR Summary">
    <Table>
      <Row>
        <Cell><Data ss:Type="String">Section</Data></Cell>
        <Cell><Data ss:Type="String">Field</Data></Cell>
        <Cell><Data ss:Type="String">Value</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">Submission</Data></Cell>
        <Cell><Data ss:Type="String">Form</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(submittedFormLabel)}</Data></Cell>
      </Row>
      ${summaryRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Raw Materials">
    <Table>
      <Row>
        <Cell><Data ss:Type="String">#</Data></Cell>
        <Cell><Data ss:Type="String">Part Reference</Data></Cell>
        <Cell><Data ss:Type="String">Reference Designation</Data></Cell>
        <Cell><Data ss:Type="String">Quantity per Unit</Data></Cell>
        <Cell><Data ss:Type="String">RM Current Stock</Data></Cell>
        <Cell><Data ss:Type="String">Last Purchase Price</Data></Cell>
      </Row>
      ${rawMaterialRows}
    </Table>
  </Worksheet>
</Workbook>`

  return Buffer.from(workbook, 'utf8')
}

const buildSafeReference = (value) => String(value || 'ssr')
  .trim()
  .replace(/[^a-z0-9-_]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase()

const buildAttachments = (ssr, submittedFormKey, submittedFormLabel) => {
  const reference = buildSafeReference(ssr?.productReference || `ssr-${ssr?.id || 'item'}`)

  return [
    {
      filename: `${reference}-${submittedFormKey}-summary.pdf`,
      content: buildPdfBuffer(ssr, submittedFormLabel),
      contentType: 'application/pdf',
    },
    {
      filename: `${reference}-${submittedFormKey}-summary.xls`,
      content: buildExcelBuffer(ssr, submittedFormLabel),
      contentType: 'application/vnd.ms-excel',
    },
  ]
}

const buildSummaryHtml = ({ recipientName, submittedFormLabel, ssr }) => `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;">
      <tr>
        <td style="padding:24px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#f97316;margin-bottom:8px;">Submission Summary</div>
          <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;">${escapeHtml(submittedFormLabel)} submitted</h1>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#4b5563;">
            Hello ${escapeHtml(recipientName)}, the form <strong>${escapeHtml(submittedFormLabel)}</strong> has been submitted for SSR <strong>${escapeHtml(ssr?.productReference || '-')}</strong>.
          </p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#4b5563;">
            The attached PDF and Excel files contain the complete SSR details, including 4M, STS, Product Inventory, RM Availability and raw material information.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;background:#f9fafb;">Product Reference</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(ssr?.productReference || '-')}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;background:#f9fafb;">Product Designation</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(ssr?.referenceDesignation || ssr?.productDesignation || '-')}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;background:#f9fafb;">Customer</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(ssr?.customerName || '-')}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;background:#f9fafb;">Plant</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(ssr?.plant || '-')}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

const sendSubmissionSummaryEmails = async ({ ssr, submittedFormKey, submittedFormLabel }) => {
  const recipients = getSummaryRecipients()

  if (recipients.length === 0) {
    console.warn('No summary recipients configured for Hamdi/Aziza in .env')
    return
  }

  const attachments = buildAttachments(ssr, submittedFormKey, submittedFormLabel)
  const subject = `[AVOCarbon] ${submittedFormLabel} Submitted - ${ssr?.productReference || `SSR ${ssr?.id || ''}`}`.trim()

  for (const recipient of recipients) {
    await sendMailOnce({
      dedupeKey: ['submission-summary', normalizeEmail(recipient.email), submittedFormKey, ssr?.id || ''].join('|'),
      mailOptions: {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipient.email,
        subject,
        html: buildSummaryHtml({
          recipientName: recipient.name,
          submittedFormLabel,
          ssr,
        }),
        attachments,
      },
    })
  }
}

module.exports = {
  sendSubmissionSummaryEmails,
}
