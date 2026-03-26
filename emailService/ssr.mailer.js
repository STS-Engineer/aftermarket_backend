// ssr.mailer.js
const nodemailer = require('nodemailer');
const jwt        = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
  host:       process.env.SMTP_HOST,
  port:       parseInt(process.env.SMTP_PORT || '587', 10),
  secure:     process.env.SMTP_SECURE === 'true',
  requireTLS: true,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
  tls: { rejectUnauthorized: false },
});

function generateSSRToken(ssrId, role) {
  return jwt.sign(
    { ssrId, role },
    process.env.JWT_SECRET,
    { expiresIn: '90d' },
  );
}

function verifySSRToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const row = (label, value, shade) => `
  <tr style="background:${shade ? '#eef2f7' : '#ffffff'};">
    <td style="padding:12px 16px;font-size:13px;color:#1e3a5f;font-weight:700;
               white-space:nowrap;border-bottom:1px solid #d1d5db;width:38%;">${label}</td>
    <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:500;
               border-bottom:1px solid #d1d5db;">${value || '—'}</td>
  </tr>`;

const ssrRows = (ssr) => `
  ${row('Référence SSR',    ssr.reference,    false)}
  ${row('Désignation',      ssr.designation,  true)}
  ${row('Quantité',         ssr.quantity,     false)}
  ${row('Demandeur',        ssr.requester,    true)}
  ${row('Date de demande',  ssr.date,         false)}
  ${ssr.comment ? row('Commentaire', ssr.comment, true) : ''}
`;

const emailWrapper = (headerColor, title, subtitle, recipientName, bodyContent) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="max-width:620px;background:#ffffff;border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#ffffff;border-bottom:3px solid ${headerColor};
                     padding:32px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:3px;
                      color:#1e3a5f;text-transform:uppercase;">AVOCarbon — Administration STS</p>
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#1e3a5f;line-height:1.3;">
              ${title}
            </h1>
            <p style="margin:10px 0 0;font-size:13px;color:#1e3a5f;opacity:0.75;">
              ${subtitle}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px;font-size:15px;color:#111827;font-weight:600;line-height:1.6;">
              Bonjour <strong style="color:#1e3a5f;">${recipientName}</strong>,
            </p>
            ${bodyContent}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e5e7eb;
                     padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
              &copy; ${new Date().getFullYear()} AVOCarbon — Administration STS. Tous droits réservés.<br/>
              Ceci est un message automatique, veuillez ne pas répondre directement à cet email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Email 1 : Fadwa — lien vers le formulaire de validation ──────────────────

async function sendSSREmail1({ ssr }) {
  const token      = generateSSRToken(ssr.id, 'fadwa');
  const base       = process.env.BACKEND_URL || 'http://localhost:3000';
  const formUrl    = `${base}/api/ssr-actions/form1/${token}`;

  const fadwaEmail = process.env.FADWA_EMAIL;
  const fadwaName  = process.env.FADWA_NAME || 'Fadwa';

  const bodyContent = `
    <p style="margin:0 0 28px;font-size:14px;color:#1f2937;line-height:1.7;">
      Une nouvelle <strong>Small Serial Request</strong> vient d'être créée et nécessite
      votre traitement via le formulaire ci-dessous.
    </p>

    <!-- SSR details -->
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:28px;">
      <div style="background:#1e3a5f;padding:12px 16px;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:1px;
                  color:#93c5fd;text-transform:uppercase;">Détails de la SSR</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${ssrRows(ssr)}
      </table>
    </div>

    <!-- CTA -->
    <p style="margin:0 0 20px;font-size:14px;color:#111827;font-weight:700;text-align:center;">
      Accédez au formulaire pour traiter cette demande&nbsp;:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${formUrl}"
             style="display:inline-block;padding:12px 32px;background:#1e3a5f;
                    color:#ffffff;text-decoration:none;border-radius:8px;
                    font-size:14px;font-weight:700;letter-spacing:0.4px;
                    border:1px solid #1e3a5f;">
            📋 &nbsp;Ouvrir le Formulaire
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#6b7280;text-align:center;font-weight:500;">
      ⏱ Ce lien est valide pendant <strong style="color:#374151;">3 mois</strong>.
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br/>
      <span style="font-size:11px;color:#9ca3af;word-break:break-all;">${formUrl}</span>
    </p>`;

  const html = emailWrapper(
    '#1e3a5f',
    'Nouveau Formulaire SSR à Traiter',
    'Une Small Serial Request requiert votre intervention',
    fadwaName,
    bodyContent,
  );

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'administration.STS@avocarbon.com',
    to:      fadwaEmail,
    subject: `[AVOCarbon] Nouvelle SSR — Formulaire à compléter : ${ssr.reference || ssr.id}`,
    html,
  });

  console.log(`📧 SSR Email 1 envoyé à Fadwa (${fadwaEmail})`);
}

// ── Email 2 : Hamdi & Aziza — lien de consultation / validation ──────────────

async function sendSSREmail2({ ssr }) {
  const token   = generateSSRToken(ssr.id, 'validator');
  const base    = process.env.BACKEND_URL || 'http://localhost:3000';
  const formUrl = `${base}/api/ssr-actions/form2/${token}`;

  const recipients = [
    { name: process.env.HAMDI_NAME  || 'Hamdi',  email: process.env.HAMDI_EMAIL  },
    { name: process.env.AZIZA_NAME  || 'Aziza',  email: process.env.AZIZA_EMAIL  },
  ].filter(r => r.email);

  for (const recipient of recipients) {
    const bodyContent = `
      <p style="margin:0 0 28px;font-size:14px;color:#1f2937;line-height:1.7;">
        Une nouvelle <strong>Small Serial Request</strong> a été soumise et est disponible
        pour consultation et validation via le lien ci-dessous.
      </p>

      <!-- SSR details -->
      <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:28px;">
        <div style="background:#1e3a5f;padding:12px 16px;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:1px;
                    color:#93c5fd;text-transform:uppercase;">Détails de la SSR</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${ssrRows(ssr)}
        </table>
      </div>

      <!-- CTA -->
      <p style="margin:0 0 20px;font-size:14px;color:#111827;font-weight:700;text-align:center;">
        Accédez au formulaire de validation&nbsp;:
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <a href="${formUrl}"
               style="display:inline-block;padding:12px 32px;background:#16a34a;
                      color:#ffffff;text-decoration:none;border-radius:8px;
                      font-size:14px;font-weight:700;letter-spacing:0.4px;
                      border:1px solid #15803d;">
              ✓ &nbsp;Accéder au Formulaire de Validation
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:24px 0 0;font-size:12px;color:#6b7280;text-align:center;font-weight:500;">
        ⏱ Ce lien est valide pendant <strong style="color:#374151;">3 mois</strong>.
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br/>
        <span style="font-size:11px;color:#9ca3af;word-break:break-all;">${formUrl}</span>
      </p>`;

    const html = emailWrapper(
      '#16a34a',
      'Nouvelle SSR — Validation Requise',
      'Une Small Serial Request est en attente de votre validation',
      recipient.name,
      bodyContent,
    );

    await transporter.sendMail({
      from:    process.env.SMTP_FROM || 'administration.STS@avocarbon.com',
      to:      recipient.email,
      subject: `[AVOCarbon] SSR à valider : ${ssr.reference || ssr.id}`,
      html,
    });

    console.log(`📧 SSR Email 2 envoyé à ${recipient.name} (${recipient.email})`);
  }
}

module.exports = {
  sendSSREmail1,
  sendSSREmail2,
  generateSSRToken,
  verifySSRToken,
};