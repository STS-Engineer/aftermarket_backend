const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ')
  return normalized || null
}

const splitFullName = (fullName) => {
  const normalized = normalizeWhitespace(fullName)
  if (!normalized) {
    return {
      firstName: null,
      lastName: null,
    }
  }

  const parts = normalized.split(' ')

  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  }
}

const toPlainSalesRep = (salesRep) => {
  if (!salesRep) return null
  if (typeof salesRep.get === 'function') {
    return salesRep.get({ plain: true })
  }

  return { ...salesRep }
}

const getSalesRepDisplayName = (salesRep) => {
  if (!salesRep) return ''

  if (typeof salesRep === 'string') {
    return normalizeWhitespace(salesRep) || ''
  }

  const plainSalesRep = toPlainSalesRep(salesRep)

  return normalizeWhitespace(
    plainSalesRep.full_name
    || plainSalesRep.display_name
    || [plainSalesRep.first_name, plainSalesRep.last_name].filter(Boolean).join(' ')
  ) || ''
}

const formatSalesRep = (salesRep) => {
  const plainSalesRep = toPlainSalesRep(salesRep)
  if (!plainSalesRep) return null

  const fullName = getSalesRepDisplayName(plainSalesRep)
  const { firstName, lastName } = splitFullName(fullName)

  return {
    ...plainSalesRep,
    dept: normalizeWhitespace(plainSalesRep.dept),
    full_name: fullName || null,
    first_name: normalizeWhitespace(plainSalesRep.first_name) || firstName,
    last_name: normalizeWhitespace(plainSalesRep.last_name) || lastName,
    display_name: fullName || null,
    email: normalizeWhitespace(plainSalesRep.email),
    localisation: normalizeWhitespace(plainSalesRep.localisation),
    region: normalizeWhitespace(plainSalesRep.region),
    attached_plant: normalizeWhitespace(plainSalesRep.attached_plant),
    note: plainSalesRep.note ?? null,
  }
}

module.exports = {
  formatSalesRep,
  getSalesRepDisplayName,
  normalizeWhitespace,
}
