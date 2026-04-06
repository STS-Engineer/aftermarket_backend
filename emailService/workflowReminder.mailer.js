const { transporter } = require('./mailTransport')
const { generateFourMAccessToken, generateStsAccessToken } = require('./ssr.mailer')
const { getSalesRepDisplayName } = require('../utils/salesRep')

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatDateTime = (value) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const getKamName = (ssr) => {
  const fullName = getSalesRepDisplayName(ssr?.kam)
  if (fullName) return fullName
  if (typeof ssr?.kam === 'string' && ssr.kam.trim()) return ssr.kam.trim()
  if (ssr?.kamName) return ssr.kamName
  if (ssr?.kam_id || ssr?.kamId) return `KAM #${ssr.kam_id || ssr.kamId}`
  return '-'
}

const getRecipientGroup = (formKey) => {
  const fadwa = {
    name: process.env.FADWA_NAME || 'Fadwa',
    email: normalizeEmail(process.env.FADWA_EMAIL),
  }

  const stsRecipients = [
    { name: process.env.HAMDI_NAME || 'Hamdi', email: normalizeEmail(process.env.HAMDI_EMAIL) },
    { name: process.env.AZIZA_NAME || 'Aziza', email: normalizeEmail(process.env.AZIZA_EMAIL) },
  ].filter((recipient, index, array) => recipient.email && array.findIndex((entry) => entry.email === recipient.email) === index)

  if (formKey === 'fourM' || formKey === 'productInventory') {
    return fadwa.email ? [fadwa] : []
  }

  return stsRecipients
}

const getActionUrl = (formKey, ssrId) => {
  const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const stsToken = generateStsAccessToken(ssrId)

  switch (formKey) {
    case 'fourM':
      return `${frontendBaseUrl}/4M-validation/${generateFourMAccessToken(ssrId)}`
    case 'sts':
      return `${frontendBaseUrl}/sts-form/${stsToken}`
    case 'productInventory':
      return `${frontendBaseUrl}/product-inventory-validation/${stsToken}`
    case 'rmAvailability':
      return `${frontendBaseUrl}/rm-availability-validation/${stsToken}`
    case 'specificRMStudy':
      return `${frontendBaseUrl}/specific-rm-study-form/${stsToken}`
    default:
      return frontendBaseUrl
  }
}

const buildReminderHtml = ({ ssr, formLabel, startedAt, delayHours, actionUrl, recipientNames }) => `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:0;background:linear-gradient(135deg,#fff7ed 0%,#ffffff 60%);border-bottom:1px solid #e5e7eb;">
          <div style="padding:22px 24px 10px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ea580c;">Workflow Reminder</div>
          <div style="padding:0 24px 22px;">
            <h1 style="margin:0 0 8px;font-size:26px;line-height:1.15;color:#111827;">${escapeHtml(formLabel)} is still pending</h1>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#4b5563;">
              Hello ${escapeHtml(recipientNames)}, this is an automatic reminder for SSR <strong>${escapeHtml(ssr?.productReference || '-')}</strong>.
              The form <strong>${escapeHtml(formLabel)}</strong> has been waiting for more than <strong>${escapeHtml(String(delayHours))} hour(s)</strong>.
            </p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px;">
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;font-weight:600;background:#f9fafb;width:34%;">Product Reference</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(ssr?.productReference || '-')}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;font-weight:600;background:#f9fafb;">Product Designation</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(ssr?.referenceDesignation || ssr?.productDesignation || '-')}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;font-weight:600;background:#f9fafb;">Customer</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(ssr?.customerName || '-')}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;font-weight:600;background:#f9fafb;">KAM</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(getKamName(ssr))}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;font-weight:600;background:#f9fafb;">Plant</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(ssr?.plant || ssr?.avoPlant || '-')}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:12px;font-weight:600;background:#f9fafb;">Waiting Since</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;">${escapeHtml(formatDateTime(startedAt))}</td>
            </tr>
          </table>

          <div style="padding:14px 16px;border:1px solid rgba(249,115,22,.18);border-radius:12px;background:#fff7ed;margin-bottom:18px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#c2410c;margin-bottom:6px;">Action Required</div>
            <div style="font-size:14px;line-height:1.7;color:#7c2d12;">
              Please open the pending form and complete it so the SSR workflow can continue without blocking the next team.
            </div>
          </div>

          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#f97316;border:1px solid #ea580c;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
            Open ${escapeHtml(formLabel)}
          </a>
        </td>
      </tr>
    </table>
  </body>
</html>
`

const sendWorkflowReminderEmail = async ({ ssr, formKey, formLabel, startedAt, delayHours }) => {
  const recipients = getRecipientGroup(formKey)
  if (recipients.length === 0) {
    console.warn(`No recipients configured for workflow reminder: ${formKey}`)
    return []
  }

  const actionUrl = getActionUrl(formKey, ssr.id)
  const recipientEmails = recipients.map((recipient) => recipient.email)
  const recipientNames = recipients.map((recipient) => recipient.name).join(' & ')

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipientEmails.join(','),
    subject: `[AVOCarbon] Reminder - ${formLabel} pending - ${ssr?.productReference || `SSR ${ssr?.id || ''}`}`.trim(),
    html: buildReminderHtml({
      ssr,
      formLabel,
      startedAt,
      delayHours,
      actionUrl,
      recipientNames,
    }),
  })

  return recipientEmails
}

module.exports = {
  sendWorkflowReminderEmail,
}
