const jwt = require('jsonwebtoken')
const { transporter } = require('./mailTransport')

const generatePasswordResetToken = ({ memberId, email }) => jwt.sign(
  { memberId, email, purpose: 'password_reset' },
  process.env.JWT_SECRET,
  { expiresIn: process.env.PASSWORD_RESET_TOKEN_EXPIRES_IN || '1h' },
)

const verifyPasswordResetToken = (token) => jwt.verify(token, process.env.JWT_SECRET)

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const buildPasswordResetHtml = ({ recipientName, resetUrl }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Password</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:'Geist','Segoe UI',system-ui,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 8px 28px rgba(13,17,23,0.08);overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;background:#fafafa;border-bottom:1px solid #e5e7eb;">
                <div style="display:inline-block;padding:3px 9px;border:1px solid rgba(249,115,22,0.30);border-radius:999px;background:rgba(249,115,22,0.07);color:#ea580c;font-size:10px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;margin-bottom:10px;">Password Reset</div>
                <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;line-height:1.2;color:#0d1117;">Reset your password</h1>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">A password reset was requested for ${escapeHtml(recipientName || 'your account')}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#374151;">
                  Click the button below to open the reset password form and choose a new password.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                  <tr>
                    <td bgcolor="#f97316" style="border-radius:10px;border:1px solid #ea580c;background:#f97316;box-shadow:0 3px 10px rgba(249,115,22,.35);text-align:center;">
                      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;background:#f97316;white-space:nowrap;">
                        Open Reset Password Form
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#9ca3af;">
                  This link expires automatically. If you did not request this change, you can ignore this email.
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

const sendPasswordResetEmail = async ({ email, recipientName, token }) => {
  const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const resetUrl = `${frontendBaseUrl}/reset-password/${token}`

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: '[AVOCarbon] Reset your password',
    html: buildPasswordResetHtml({
      recipientName,
      resetUrl,
    }),
  })
}

module.exports = {
  generatePasswordResetToken,
  verifyPasswordResetToken,
  sendPasswordResetEmail,
}
