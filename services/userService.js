const CompanyMember = require('../models/User')
const UserAuth = require('../models/UserAuth')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { generatePasswordResetToken, verifyPasswordResetToken, sendPasswordResetEmail } = require('../emailService/auth.mailer')

async function getAllUsers() {
  return CompanyMember.findAll({
    attributes: { exclude: [] },
    order: [['last_name', 'ASC'], ['first_name', 'ASC']],
  })
}

async function signIn(email, password) {
  const member = await CompanyMember.findOne({ where: { email } })

  if (!member) {
    const err = new Error('Email ou mot de passe incorrect.')
    err.status = 401
    throw err
  }

  const userAuth = await UserAuth.findOne({ where: { member_id: member.id } })   

  if (!userAuth) {
    const err = new Error('Ce compte ne dispose pas d\'un mot de passe local.')
    err.status = 403
    throw err
  }

  const valid = await bcrypt.compare(password, userAuth.password)
  if (!valid) {
    const err = new Error('Email ou mot de passe incorrect.')
    err.status = 401
    throw err
  }

  const token = jwt.sign(
    {
      id: member.id,
      email: member.email,
      account_type: member.account_type,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  )

  return {
    token,
    member: {
      id: member.id,
      display_name: member.display_name,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      job_title: member.job_title,
      department: member.department,
      account_type: member.account_type,
    },
  }
}

async function getUserById(id) {
  const member = await CompanyMember.findByPk(id)

  if (!member) {
    const err = new Error(`Membre #${id} introuvable.`)
    err.status = 404
    throw err
  }

  return {
    id: member.id,
    display_name: member.display_name,
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    job_title: member.job_title,
    department: member.department,
    site: member.site,
    country: member.country,
    account_type: member.account_type,
    manager_id: member.manager_id,
    manager_email: member.manager_email,
    depth: member.depth,
  }
}

async function changePassword(memberId, oldPassword, newPassword) {
  const member = await CompanyMember.findByPk(memberId)
  if (!member) {
    const err = new Error(`Membre #${memberId} introuvable.`)
    err.status = 404
    throw err
  }

  const userAuth = await UserAuth.findOne({ where: { member_id: memberId } })
  if (!userAuth) {
    const err = new Error('Aucun mot de passe local trouv� pour ce compte.')
    err.status = 404
    throw err
  }

  const valid = await bcrypt.compare(oldPassword, userAuth.password)
  if (!valid) {
    const err = new Error('Ancien mot de passe incorrect.')
    err.status = 401
    throw err
  }

  await userAuth.update({ password: newPassword })

  return { message: 'Mot de passe mis � jour avec succ�s.' }
}

async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    const err = new Error('Email is required.')
    err.status = 400
    throw err
  }

  const userAuth = await UserAuth.findOne({ where: { email: normalizedEmail } })
  if (!userAuth) {
    return { message: 'If an account exists for this email, a reset link has been sent.' }
  }

  const member = await CompanyMember.findByPk(userAuth.member_id)
  const token = generatePasswordResetToken({
    memberId: userAuth.member_id,
    email: userAuth.email,
  })

  await sendPasswordResetEmail({
    email: userAuth.email,
    recipientName: member?.display_name || [member?.first_name, member?.last_name].filter(Boolean).join(' ') || userAuth.email,
    token,
  })

  return { message: 'If an account exists for this email, a reset link has been sent.' }
}

async function verifyResetPasswordRequest(token) {
  let payload

  try {
    payload = verifyPasswordResetToken(token)
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('This reset link has expired. Please request a new one.')
      err.status = 401
      throw err
    }

    const err = new Error('Invalid reset link.')
    err.status = 401
    throw err
  }

  if (payload.purpose !== 'password_reset') {
    const err = new Error('Invalid reset link.')
    err.status = 401
    throw err
  }

  const userAuth = await UserAuth.findOne({
    where: {
      member_id: payload.memberId,
      email: payload.email,
    },
  })

  if (!userAuth) {
    const err = new Error('Invalid reset link.')
    err.status = 404
    throw err
  }

  return {
    email: userAuth.email,
    memberId: payload.memberId,
  }
}

async function resetPasswordWithToken(token, newPassword) {
  if (!newPassword || String(newPassword).length < 6) {
    const err = new Error('New password must be at least 6 characters.')
    err.status = 400
    throw err
  }

  const { memberId } = await verifyResetPasswordRequest(token)
  const userAuth = await UserAuth.findOne({ where: { member_id: memberId } })

  if (!userAuth) {
    const err = new Error('Invalid reset link.')
    err.status = 404
    throw err
  }

  const samePassword = await bcrypt.compare(newPassword, userAuth.password)
  if (samePassword) {
    const err = new Error('New password must be different from the current password.')
    err.status = 400
    throw err
  }

  await userAuth.update({ password: newPassword })
  return { message: 'Password reset successfully. You can sign in now.' }
}

module.exports = {
  getAllUsers,
  getUserById,
  signIn,
  changePassword,
  requestPasswordReset,
  verifyResetPasswordRequest,
  resetPasswordWithToken,
}
