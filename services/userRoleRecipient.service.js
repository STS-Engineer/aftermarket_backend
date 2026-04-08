const { Op } = require('sequelize')
const UserAuth = require('../models/UserAuth')
const CompanyMember = require('../models/User')

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const buildRecipientName = (member, fallbackEmail) => (
  String(
    member?.display_name
    || [member?.first_name, member?.last_name].filter(Boolean).join(' ')
    || fallbackEmail
    || 'Team',
  ).trim()
)

async function getUserRecipientsByRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase()
  if (!normalizedRole) return []

  const authRows = await UserAuth.findAll({
    attributes: ['member_id', 'email', 'role'],
  })

  const matchingAuthRows = authRows
    .map((row) => (typeof row.get === 'function' ? row.get({ plain: true }) : row))
    .filter((row) => String(row?.role || '').trim().toLowerCase() === normalizedRole)

  if (matchingAuthRows.length === 0) {
    return []
  }

  const memberIds = [...new Set(
    matchingAuthRows
      .map((row) => row.member_id)
      .filter((value) => value !== undefined && value !== null),
  )]

  const members = memberIds.length > 0
    ? await CompanyMember.findAll({
      where: { id: { [Op.in]: memberIds } },
      attributes: ['id', 'display_name', 'first_name', 'last_name', 'email'],
    })
    : []

  const membersById = members.reduce((acc, member) => {
    const plainMember = typeof member.get === 'function' ? member.get({ plain: true }) : member
    acc.set(plainMember.id, plainMember)
    return acc
  }, new Map())

  const seenEmails = new Set()

  return matchingAuthRows.reduce((acc, row) => {
    const member = membersById.get(row.member_id)
    const email = normalizeEmail(row.email || member?.email)

    if (!email || seenEmails.has(email)) {
      return acc
    }

    seenEmails.add(email)
    acc.push({
      key: `${normalizedRole}:${row.member_id || email}`,
      memberId: row.member_id || null,
      role: normalizedRole,
      email,
      name: buildRecipientName(member, email),
    })

    return acc
  }, [])
}

module.exports = {
  getUserRecipientsByRole,
}
