const nodemailer = require('nodemailer')

const isTrue = (value) => String(value || '').trim().toLowerCase() === 'true'

const resolveSmtpSettings = () => {
  const rawHost = String(process.env.SMTP_HOST || '').trim()
  const rawPort = parseInt(process.env.SMTP_PORT || '587', 10)
  const hasAuthUser = !!String(process.env.SMTP_USER || '').trim()
  const looksLikeMicrosoftMx = /\.mail\.protection\.outlook\.com$/i.test(rawHost)
  const disableAuth = isTrue(process.env.SMTP_DISABLE_AUTH)
  const forceAuth = isTrue(process.env.SMTP_FORCE_AUTH)
  const shouldUseRelayWithoutAuth =
    !forceAuth &&
    (disableAuth || (looksLikeMicrosoftMx && rawPort === 25))

  if (!shouldUseRelayWithoutAuth && looksLikeMicrosoftMx && hasAuthUser) {
    return {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      requireTLS: true,
      useAuth: true,
    }
  }

  return {
    host: rawHost,
    port: rawPort,
    secure: isTrue(process.env.SMTP_SECURE),
    requireTLS: shouldUseRelayWithoutAuth ? false : !isTrue(process.env.SMTP_SECURE),
    useAuth: shouldUseRelayWithoutAuth ? false : hasAuthUser,
  }
}

const smtpSettings = resolveSmtpSettings()

const transporter = nodemailer.createTransport({
  host: smtpSettings.host,
  port: smtpSettings.port,
  secure: smtpSettings.secure,
  requireTLS: smtpSettings.requireTLS,
  auth: smtpSettings.useAuth ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
  tls: { rejectUnauthorized: false },
})

module.exports = {
  transporter,
  smtpSettings,
}
