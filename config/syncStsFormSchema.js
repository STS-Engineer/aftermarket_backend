const sequelize = require('./sequelize')

const LEGACY_STS_COLUMNS = [
  'product_reference',
  'kam_id',
  'kam_name',
  'plant',
  'product_designation',
  'quantity_requested',
]

const isMissingTableError = (error) => {
  if (!error) return false

  return (
    error?.original?.code === '42P01'
    || /does not exist/i.test(error.message || '')
    || /unknown table/i.test(error.message || '')
  )
}

const syncStsFormSchema = async () => {
  const queryInterface = sequelize.getQueryInterface()
  let columns

  try {
    columns = await queryInterface.describeTable('sts_forms')
  } catch (error) {
    if (isMissingTableError(error)) {
      return
    }

    throw error
  }

  for (const columnName of LEGACY_STS_COLUMNS) {
    if (!columns[columnName]) continue

    await queryInterface.removeColumn('sts_forms', columnName)
    console.log(`Removed legacy sts_forms column: ${columnName}`)
  }
}

module.exports = syncStsFormSchema
