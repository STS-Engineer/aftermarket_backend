// mailer.js — ajouts pour SSR (Small Serial Request)

const { sendSSREmail1, sendSSREmail2 } = require('./ssr.mailer');

// ── SSR Token generators ──────────────────────────────────────────────────────

function generateSSRFormToken(ssrId, role) {
  return jwt.sign(
    { ssrId, role },
    process.env.JWT_SECRET,
    { expiresIn: '90d' },
  );
}

function verifySSRFormToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}