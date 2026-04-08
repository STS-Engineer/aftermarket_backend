const nodemailer = require('nodemailer')
const jwt = require('jsonwebtoken')
const { getSalesRepDisplayName } = require('../utils/salesRep')
const { getUserRecipientsByRole } = require('../services/userRoleRecipient.service')

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  requireTLS: process.env.SMTP_SECURE !== 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
  tls: { rejectUnauthorized: false },
})

const RECENT_EMAIL_WINDOW_MS = 5 * 60 * 1000
const recentEmailKeys = new Map()

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const getInitialWorkflowRecipients = async () => {
  const siteRecipients = await getUserRecipientsByRole('site')
  const stsRecipients = await getUserRecipientsByRole('sts')

  return {
    siteRecipients,
    stsRecipients,
  }
}

const sendMailOnce = async ({ dedupeKey, mailOptions, windowMs = RECENT_EMAIL_WINDOW_MS }) => {
  const now = Date.now()

  for (const [key, timestamp] of recentEmailKeys.entries()) {
    if (now - timestamp > windowMs) {
      recentEmailKeys.delete(key)
    }
  }

  if (dedupeKey && recentEmailKeys.has(dedupeKey)) {
    console.warn(`Skipping duplicate email send for key: ${dedupeKey}`)
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

const generateFourMAccessToken = (ssrId) => jwt.sign(
  { ssrId, purpose: 'four_m_validation_access' },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
)

const generateStsAccessToken = (ssrId) => jwt.sign(
  { ssrId, purpose: 'sts_form_access' },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
)

const verifyFourMAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET)
const verifyStsAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET)

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const formatDate = (value) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return escapeHtml(value)

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const getKamName = (ssr) => {
  const fullName = getSalesRepDisplayName(ssr?.kam)
  if (fullName) return fullName

  if (typeof ssr?.kam === 'string' && ssr.kam.trim()) {
    return ssr.kam.trim()
  }

  if (ssr?.kam_id) {
    return `KAM #${ssr.kam_id}`
  }

  return '-'
}

const fieldCard = (label, value) => `
  <td style="padding:0 8px 12px;vertical-align:top;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
      border:1px solid #e5e7eb;
      border-radius:10px;
      background:#f9fafb;
      border-collapse:separate;
    ">
      <tr>
        <td style="
          padding:10px 11px 6px;
          color:#6b7280;
          font-size:11px;
          font-weight:600;
          letter-spacing:0.03em;
          text-transform:uppercase;
        ">${escapeHtml(label)}</td>
      </tr>
      <tr>
        <td style="
          padding:0 11px 11px;
          color:#0d1117;
          font-size:14px;
          line-height:1.5;
          font-weight:500;
          word-break:break-word;
        ">${escapeHtml(value || '-')}</td>
      </tr>
    </table>
  </td>
`

const sectionCard = ({ icon, title, subtitle, rows, fullWidth = false }) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
    margin:0 0 10px;
    background:#ffffff;
    border:1px solid #e5e7eb;
    border-radius:14px;
    box-shadow:0 1px 3px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04);
    border-collapse:separate;
  ">
    <tr>
      <td style="
        padding:14px 20px;
        border-bottom:1px solid #e5e7eb;
        background:#fafafa;
        border-radius:14px 14px 0 0;
      ">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:11px;vertical-align:top;">
              <div style="
                width:28px;
                height:28px;
                border-radius:8px;
                background:rgba(249,115,22,0.07);
                border:1px solid rgba(249,115,22,0.30);
                color:#f97316;
                text-align:center;
                line-height:28px;
                font-size:13px;
                font-weight:700;
              ">${icon}</div>
            </td>
            <td>
              <div style="
                font-size:12px;
                font-weight:600;
                color:#0d1117;
                letter-spacing:0.02em;
                text-transform:uppercase;
                line-height:1.2;
                margin-bottom:3px;
              ">${escapeHtml(title)}</div>
              <div style="
                font-size:11px;
                color:#9ca3af;
                line-height:1.4;
              ">${escapeHtml(subtitle)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:${fullWidth ? '18px 20px' : '18px 12px 6px'};">
        ${rows}
      </td>
    </tr>
  </table>
`

const twoColumnRow = (leftLabel, leftValue, rightLabel, rightValue) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      ${fieldCard(leftLabel, leftValue)}
      ${fieldCard(rightLabel, rightValue)}
    </tr>
  </table>
`

const fullWidthRow = (label, value) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      ${fieldCard(label, value)}
    </tr>
  </table>
`

const formatBooleanStatus = (value) => {
  if (value === true) return 'OK'
  if (value === false) return 'NOK'
  return '-'
}

const formatRawMaterialsForEmail = (rawMaterials = []) => {
  if (!Array.isArray(rawMaterials) || rawMaterials.length === 0) {
    return fullWidthRow('Raw Materials', 'No raw materials provided')
  }

  const rows = rawMaterials.map((row, index) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        ${fieldCard(`RM ${index + 1} Part Reference`, row.partReference)}
        ${fieldCard(`RM ${index + 1} Designation`, row.referenceDesignation)}
      </tr>
      <tr>
        ${fieldCard(`RM ${index + 1} Qty / Unit`, row.quantityPerUnit)}
        ${fieldCard(`RM ${index + 1} Current Stock`, row.rmCurrentStock)}
      </tr>
      <tr>
        ${fieldCard(`RM ${index + 1} Last Purchase Price`, row.lastPurchasePrice)}
      </tr>
    </table>
  `).join('')

  return rows
}

const buildActionCard = ({ title, description, actionUrl, buttonLabel }) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
    margin:0 0 10px;
    background:#ffffff;
    border:1px solid #e5e7eb;
    border-radius:14px;
    box-shadow:0 1px 3px rgba(13,17,23,0.06), 0 1px 2px rgba(13,17,23,0.04);
    border-collapse:separate;
  ">
    <tr>
      <td style="padding:18px 20px;">
        <div style="
          font-size:12px;
          font-weight:600;
          color:#0d1117;
          letter-spacing:0.02em;
          text-transform:uppercase;
          line-height:1.2;
          margin-bottom:8px;
        ">${escapeHtml(title)}</div>
        <p style="
          margin:0 0 16px;
          font-size:13px;
          color:#6b7280;
          line-height:1.6;
        ">
          ${escapeHtml(description)}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
          <tr>
            <td bgcolor="#f97316" style="
              border-radius:10px;
              border:1px solid #ea580c;
              background:#f97316;
              background-color:#f97316;
              box-shadow:0 3px 10px rgba(249,115,22,.35), inset 0 1px 0 rgba(255,255,255,.12);
              text-align:center;
            ">
              <a href="${escapeHtml(actionUrl)}" style="
                display:inline-block;
                padding:10px 16px;
                border-radius:10px;
                font-size:13px;
                font-weight:600;
                letter-spacing:0.01em;
                color:#ffffff;
                text-decoration:none;
                background:#f97316;
                background-color:#f97316;
                white-space:nowrap;
              ">
                ${escapeHtml(buttonLabel)}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`

const buildInlineLink = (label, href) => `
  <div style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#6b7280;">
    <a href="${escapeHtml(href)}" style="color:#ea580c;text-decoration:none;font-weight:600;">${escapeHtml(label)}</a>
  </div>
`

const buildHtml = ({ recipientName, ssr, action = null, introHtml = '' }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Small Serial Request</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Geist','Segoe UI',system-ui,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:1100px;">
            <tr>
              <td style="padding:0 0 24px;">
                <div style="
                  display:inline-block;
                  padding:3px 9px;
                  border:1px solid rgba(249,115,22,0.30);
                  border-radius:999px;
                  background:rgba(249,115,22,0.07);
                  color:#ea580c;
                  font-size:10px;
                  font-weight:600;
                  letter-spacing:0.09em;
                  text-transform:uppercase;
                  margin-bottom:10px;
                ">Small Serial Request</div>
                <h1 style="
                  margin:0 0 5px;
                  font-size:24px;
                  font-weight:700;
                  color:#0d1117;
                  letter-spacing:-0.035em;
                  line-height:1.2;
                ">Create a New Request</h1>
                <p style="
                  margin:0;
                  font-size:13px;
                  color:#6b7280;
                  line-height:1.55;
                ">
                  Fill in all required fields to submit a production request to the team.
                </p>
                ${introHtml}
              </td>
            </tr>

            <tr>
              <td>
                <div style="
                  display:flex;
                  align-items:center;
                  gap:9px;
                  padding:10px 14px;
                  border-radius:10px;
                  background:rgba(16,185,129,0.08);
                  border:1px solid rgba(16,185,129,0.22);
                  color:#065f46;
                  font-size:13px;
                  font-weight:500;
                  margin-bottom:10px;
                ">
                  <span style="
                    display:inline-block;
                    width:18px;
                    height:18px;
                    line-height:18px;
                    text-align:center;
                    border-radius:50%;
                    background:#10b981;
                    color:#ffffff;
                    font-size:10px;
                    font-weight:700;
                  ">✓</span>
                  Request submitted successfully for ${escapeHtml(recipientName)}.
                </div>

                ${action ? buildActionCard(action) : ''}

                ${sectionCard({
                  icon: 'P',
                  title: 'Product Information',
                  subtitle: 'Reference, designation and family',
                  rows: `
                    ${twoColumnRow('Product Reference', ssr.productReference, 'Reference Designation', ssr.referenceDesignation)}
                    ${fullWidthRow('Product Family', ssr.productFamily)}
                  `,
                })}

                ${sectionCard({
                  icon: 'C',
                  title: 'Customer Information',
                  subtitle: 'Account name and key account manager',
                  rows: `
                    ${twoColumnRow('Customer Name', ssr.customerName || '-', 'KAM', getKamName(ssr))}
                  `,
                })}

                ${sectionCard({
                  icon: 'O',
                  title: 'Order Details',
                  subtitle: 'Production site, quantity and requested date',
                  rows: `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        ${fieldCard('Plant', ssr.plant)}
                        ${fieldCard('Quantity', ssr.quantityRequested)}
                      </tr>
                    </table>
                    ${fullWidthRow('Date Requested', formatDate(ssr.dateRequested))}
                  `,
                })}

                ${sectionCard({
                  icon: 'N',
                  title: 'Notes',
                  subtitle: 'KAM note for the internal team',
                  rows: `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="
                      border:1px solid #e5e7eb;
                      border-radius:10px;
                      background:#f9fafb;
                      border-collapse:separate;
                    ">
                      <tr>
                        <td style="
                          padding:10px 11px 6px;
                          color:#6b7280;
                          font-size:11px;
                          font-weight:600;
                          letter-spacing:0.03em;
                          text-transform:uppercase;
                        ">KAM Note</td>
                      </tr>
                      <tr>
                        <td style="
                          padding:0 11px 14px;
                          color:#0d1117;
                          font-size:14px;
                          line-height:1.6;
                          min-height:96px;
                        ">${escapeHtml(ssr.kamNote || '-')}</td>
                      </tr>
                    </table>
                  `,
                  fullWidth: true,
                })}
              </td>
            </tr>

            <tr>
              <td style="
                padding:14px 20px;
                border-top:1px solid #e5e7eb;
                background:#fafafa;
                border-radius:14px;
              ">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="
                      font-size:13px;
                      color:#6b7280;
                      line-height:1.7;
                    ">
                      This is an automatic notification sent after the creation of a small serial request.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 8px 0;text-align:center;">
                <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.7;">
                  AVOCarbon Administration STS<br />
                  This email was generated automatically.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

const buildKamConfirmationHtml = ({ recipientName, ssr }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Small Serial Request Sent</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Geist','Segoe UI',system-ui,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:860px;">
            <tr>
              <td style="padding:0 0 24px;">
                <div style="
                  display:inline-block;
                  padding:3px 9px;
                  border:1px solid rgba(249,115,22,0.30);
                  border-radius:999px;
                  background:rgba(249,115,22,0.07);
                  color:#ea580c;
                  font-size:10px;
                  font-weight:600;
                  letter-spacing:0.09em;
                  text-transform:uppercase;
                  margin-bottom:10px;
                ">Small Serial Request</div>
                <h1 style="
                  margin:0 0 5px;
                  font-size:24px;
                  font-weight:700;
                  color:#0d1117;
                  letter-spacing:-0.035em;
                  line-height:1.2;
                ">Your request has been sent</h1>
                <p style="
                  margin:0;
                  font-size:13px;
                  color:#6b7280;
                  line-height:1.55;
                ">
                  Dear ${escapeHtml(recipientName)}, your request has been successfully submitted and shared with the AfterMarket team.
                </p>
              </td>
            </tr>

            <tr>
              <td>
                ${sectionCard({
                  icon: 'S',
                  title: 'Request Summary',
                  subtitle: 'Reference details sent to the internal workflow',
                  rows: `
                    ${twoColumnRow('Product Reference', ssr.productReference, 'Reference Designation', ssr.referenceDesignation)}
                    ${twoColumnRow('Product Family', ssr.productFamily, 'Customer Name', ssr.customerName || '-')}
                    ${twoColumnRow('Plant', ssr.plant, 'Quantity Requested', ssr.quantityRequested)}
                    ${twoColumnRow('Date Requested', formatDate(ssr.dateRequested), 'KAM', getKamName(ssr))}
                    ${fullWidthRow('KAM Note', ssr.kamNote || '-')}
                  `,
                  fullWidth: true,
                })}
              </td>
            </tr>

            <tr>
              <td style="
                padding:14px 20px;
                border-top:1px solid #e5e7eb;
                background:#fafafa;
                border-radius:14px;
              ">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="
                      font-size:13px;
                      color:#6b7280;
                      line-height:1.7;
                    ">
                      This is an automatic confirmation email. No further action is required from you at this stage.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

const buildSubject = () => 'AfterMarket Demand Analysis: Small Series (4M)'
const buildStsSubject = () => 'AfterMarket Demand Analysis : Small Series'
const buildStsCompletionSubject = (ssr) => `[AVOCarbon] STS Form Submitted - ${ssr.productReference}`
const buildKamConfirmationSubject = (ssr) => `AfterMarket Demand Analysis: Request sent - ${ssr.productReference}`

const getKamRecipient = (ssr) => {
  const email = normalizeEmail(
    ssr?.kam?.email ||
    ssr?.salesRep?.email ||
    ssr?.sales_rep?.email ||
    ssr?.SalesRep?.email,
  )

  if (!email) return null

  return {
    email,
    name: getKamName(ssr) || 'Team',
  }
}

const getRecipientAction = ({ recipientKey, ssrId, frontendBaseUrl }) => {
  if (recipientKey === 'site' || recipientKey === 'fadwa') {
    const token = generateFourMAccessToken(ssrId)

    return {
      title: 'Next Step',
      description: 'Open the 4M validation form for this request. The request information will already be loaded.',
      actionUrl: `${frontendBaseUrl}/4M-validation/${token}`,
      buttonLabel: 'Open 4M Validation Form',
    }
  }

  return null
}

const sendNewSmallSerialRequestEmails = async ({ ssr }) => {
  const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const { siteRecipients, stsRecipients } = await getInitialWorkflowRecipients()
  const siteRecipientEmails = siteRecipients.map((recipient) => recipient.email)
  const siteRecipientNames = siteRecipients.map((recipient) => recipient.name).join(' & ') || 'Team'
  const stsRecipientEmails = stsRecipients.map((recipient) => recipient.email)
  const stsRecipientNames = stsRecipients.map((recipient) => recipient.name).join(' & ') || 'Team'

  if (siteRecipients.length === 0 && stsRecipients.length === 0) {
    console.warn('No SSR initial workflow email recipients configured')
    return
  }

  if (siteRecipients.length > 0) {
    const action = getRecipientAction({
      recipientKey: 'site',
      ssrId: ssr.id,
      frontendBaseUrl,
    })

    await sendMailOnce({
      dedupeKey: ['new-ssr', siteRecipientEmails.slice().sort().join(','), ssr.id, action?.actionUrl || ''].join('|'),
      mailOptions: {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: siteRecipientEmails.join(','),
        subject: buildSubject(),
        html: buildHtml({
          recipientName: siteRecipientNames,
          ssr,
          action,
          introHtml: `
                <p style="
                  margin:16px 0 0;
                  font-size:13px;
                  color:#6b7280;
                  line-height:1.55;
                ">
                  Dear Team,<br />
                  Please find all the details below. Could you kindly do the necessary ans submit an offer for the following reference: ${escapeHtml(ssr.productReference || '-')}
                </p>
          `,
        }),
      },
    })
  } else {
    console.warn('No users with role "site" are configured for 4M workflow emails')
  }

  if (stsRecipients.length > 0) {
    const action = {
      title: 'Next Step',
      description: 'Open the STS form for this request. The request information will already be loaded.',
      actionUrl: `${frontendBaseUrl}/sts-form/${generateStsAccessToken(ssr.id)}`,
      buttonLabel: 'Open STS Form',
    }

    await sendMailOnce({
      dedupeKey: ['new-ssr', stsRecipientEmails.slice().sort().join(','), ssr.id, action.actionUrl].join('|'),
      mailOptions: {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: stsRecipientEmails.join(','),
        subject: buildStsSubject(),
        html: buildHtml({
          recipientName: stsRecipientNames,
          ssr,
          action,
          introHtml: `
                <p style="
                  margin:16px 0 0;
                  font-size:13px;
                  color:#6b7280;
                  line-height:1.55;
                ">
                  Dear Team,<br />
                  Please find all the details below. Could you kindly do the necessary ans submit an offer for the following reference: ${escapeHtml(ssr.productReference || '-')}
                </p>
          `,
        }),
      },
    })
  } else {
    console.warn('No users with role "sts" are configured for SSR workflow emails')
  }
}

const sendKamRequestConfirmationEmail = async ({ ssr }) => {
  const recipient = getKamRecipient(ssr)

  if (!recipient?.email) {
    console.warn(`No KAM email configured for SSR ${ssr?.id || '-'}`)
    return
  }

  await sendMailOnce({
    dedupeKey: ['kam-request-confirmation', normalizeEmail(recipient.email), ssr.id].join('|'),
    mailOptions: {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient.email,
      subject: buildKamConfirmationSubject(ssr),
      html: buildKamConfirmationHtml({
        recipientName: recipient.name,
        ssr,
      }),
    },
  })
}

const buildStsCompletionHtml = ({ recipientName, ssr, fourMValidation, stsForm, actionUrl, formLinks }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>STS Form Submitted</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Geist','Segoe UI',system-ui,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:1100px;">
            <tr>
              <td style="padding:0 0 24px;">
                <div style="
                  display:inline-block;
                  padding:3px 9px;
                  border:1px solid rgba(249,115,22,0.30);
                  border-radius:999px;
                  background:rgba(249,115,22,0.07);
                  color:#ea580c;
                  font-size:10px;
                  font-weight:600;
                  letter-spacing:0.09em;
                  text-transform:uppercase;
                  margin-bottom:10px;
                ">STS Form Submitted</div>
                <h1 style="
                  margin:0 0 5px;
                  font-size:24px;
                  font-weight:700;
                  color:#0d1117;
                  letter-spacing:-0.035em;
                  line-height:1.2;
                ">Next form is required</h1>
                <p style="
                  margin:0;
                  font-size:13px;
                  color:#6b7280;
                  line-height:1.55;
                ">
                  The STS form has been submitted for ${escapeHtml(recipientName)}. Please fill in the Product inventory validation form.
                </p>
                <p style="
                  margin:16px 0 0;
                  font-size:13px;
                  color:#6b7280;
                  line-height:1.55;
                  white-space:pre-line;
                ">
                  Dear Site,
                  I am pleased to inform you that the work related to STS haw now been completed. Below, you will find the form for product inventory validation. Once you submit this form, you will immedoately (within a few seconds) receivr the form for raw material inventory verification.
                  If a specific case study is requires, a third form will be provided to you.
                </p>
                <div style="
                  margin:16px 0 0;
                  font-size:13px;
                  color:#6b7280;
                  line-height:1.55;
                ">
                  <p style="margin:0 0 8px;">If necessary:</p>
                  <p style="margin:0 0 8px;">In case of any erros, verification, or corrections, or if you need to access the form again, you can find the forms below:</p>
                  ${buildInlineLink('4M Validaion Form', formLinks.fourM)}
                  ${buildInlineLink('Product Inventory Validation Form', formLinks.productInventory)}
                  ${buildInlineLink('Raw Material Inventory Validation Form', formLinks.rmAvailability)}
                  ${buildInlineLink('Specific RM Study Form', formLinks.specificRmStudy)}
                  <p style="margin:8px 0 0;">Should you have any questions or need assistance, feel free to reach out.</p>
                  <p style="margin:8px 0 0;">Best regards,</p>
                </div>
              </td>
            </tr>

            <tr>
              <td>
                ${actionUrl ? buildActionCard({
                  title: 'Next Step',
                  description: 'Open the Product inventory validation form for this request. The request information will already be loaded.',
                  actionUrl,
                  buttonLabel: 'Open Product Inventory Validation Form',
                }) : ''}

                ${sectionCard({
                  icon: 'S',
                  title: 'Small Serial Request',
                  subtitle: 'Initial request information',
                  rows: `
                    ${twoColumnRow('Product Reference', ssr.productReference, 'Reference Designation', ssr.referenceDesignation)}
                    ${twoColumnRow('Customer Name', ssr.customerName || '-', 'KAM', getKamName(ssr))}
                    ${twoColumnRow('Plant', ssr.plant, 'Quantity Requested', ssr.quantityRequested)}
                    ${twoColumnRow('Product Family', ssr.productFamily, 'Date Requested', formatDate(ssr.dateRequested))}
                    ${fullWidthRow('KAM Note', ssr.kamNote || '-')}
                  `,
                })}

                ${sectionCard({
                  icon: '4',
                  title: '4M Validation',
                  subtitle: 'Current 4M validation status',
                  rows: fourMValidation ? `
                    ${twoColumnRow('Production Capacity / Week', fourMValidation.productionCapacityPerWeek, 'Document', fourMValidation.documentName || '-')}
                    ${twoColumnRow('Machine', formatBooleanStatus(fourMValidation.machineOk), 'Method', formatBooleanStatus(fourMValidation.methodOk))}
                    ${twoColumnRow('Labor', formatBooleanStatus(fourMValidation.laborOk), 'Environment', formatBooleanStatus(fourMValidation.environmentOk))}
                    ${twoColumnRow('Machine Due Date', formatDate(fourMValidation.machineDueDate), 'Method Due Date', formatDate(fourMValidation.methodDueDate))}
                    ${twoColumnRow('Labor Due Date', formatDate(fourMValidation.laborDueDate), 'Environment Due Date', formatDate(fourMValidation.environmentDueDate))}
                    ${fullWidthRow('Machine Explanation', fourMValidation.machineExplanation || '-')}
                    ${fullWidthRow('Method Explanation', fourMValidation.methodExplanation || '-')}
                    ${fullWidthRow('Labor Explanation', fourMValidation.laborExplanation || '-')}
                    ${fullWidthRow('Environment Explanation', fourMValidation.environmentExplanation || '-')}
                  ` : `
                    ${fullWidthRow('4M Validation', 'No 4M validation found for this SSR')}
                  `,
                })}

                ${sectionCard({
                  icon: 'T',
                  title: 'STS Form',
                  subtitle: 'Commercial and raw material information',
                  rows: `
                    ${twoColumnRow('Product Current Stock', stsForm?.productCurrentStock || '-', 'Last Selling Price', stsForm?.lastSellingPrice || '-')}
                    ${fullWidthRow('Last Selling Date', formatDate(stsForm?.lastSellingDate))}
                    ${formatRawMaterialsForEmail(stsForm?.rawMaterials || [])}
                  `,
                  fullWidth: true,
                })}

                ${sectionCard({
                  icon: '!',
                  title: 'Action Required',
                  subtitle: 'Pending forms to complete',
                  rows: `
                    ${fullWidthRow('Required form', 'Product inventory validation form')}
                  `,
                  fullWidth: true,
                })}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

const sendStsFormSubmittedEmailToSiteRecipients = async ({ ssr, fourMValidation, stsForm }) => {
  const recipients = await getUserRecipientsByRole('site')
  const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const accessToken = generateStsAccessToken(ssr.id)
  const fourMAccessToken = generateFourMAccessToken(ssr.id)
  const recipientEmails = recipients.map((recipient) => recipient.email)
  const recipientNames = recipients.map((recipient) => recipient.name).join(' & ') || 'Team'

  if (recipientEmails.length === 0) {
    console.warn('No users with role "site" are configured for Product Inventory emails')
    return
  }

  await sendMailOnce({
    dedupeKey: ['sts-submitted', recipientEmails.slice().sort().join(','), ssr.id, accessToken].join('|'),
    mailOptions: {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmails.join(','),
      subject: 'AfterMarket Demand Analysis:  Small Series',
      html: buildStsCompletionHtml({
        recipientName: recipientNames,
        ssr,
        fourMValidation,
        stsForm,
        actionUrl: `${frontendBaseUrl}/product-inventory-validation/${accessToken}`,
        formLinks: {
          fourM: `${frontendBaseUrl}/4M-validation/${fourMAccessToken}`,
          productInventory: `${frontendBaseUrl}/product-inventory-validation/${accessToken}`,
          rmAvailability: `${frontendBaseUrl}/rm-availability-validation/${accessToken}`,
          specificRmStudy: `${frontendBaseUrl}/specific-rm-study-form/${accessToken}`,
        },
      }),
    },
  })
}

module.exports = {
  sendNewSmallSerialRequestEmails,
  sendKamRequestConfirmationEmail,
  sendStsFormSubmittedEmailToSiteRecipients,
  generateFourMAccessToken,
  generateStsAccessToken,
  verifyFourMAccessToken,
  verifyStsAccessToken,
}
