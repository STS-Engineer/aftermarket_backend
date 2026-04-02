const { Sequelize } = require('sequelize')

const toBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  return String(value).trim().toLowerCase() === 'true'
}

const getWarehouseConfig = () => ({
  database: process.env.DW_DB_NAME || process.env.DB5_NAME || '',
  user: process.env.DW_DB_USER || process.env.DB_USER || '',
  password: process.env.DW_DB_PASSWORD || process.env.DB_PASSWORD || '',
  host: process.env.DW_DB_HOST || process.env.DB5_HOST || '',
  port: parseInt(process.env.DW_DB_PORT || process.env.DB5_PORT || process.env.DB_PORT || '5432', 10),
  ssl: toBoolean(process.env.DW_DB_SSL, toBoolean(process.env.DB_SSL, true)),
  rejectUnauthorized:
    toBoolean(process.env.DW_DB_SSL_REJECT_UNAUTHORIZED, toBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false)),
})

const isWarehouseConfigured = () => {
  const config = getWarehouseConfig()
  return Boolean(config.database && config.host && config.user)
}

let sequelizeWarehouseInstance = null

const getWarehouseSequelize = () => {
  if (!isWarehouseConfigured()) return null
  if (sequelizeWarehouseInstance) return sequelizeWarehouseInstance

  const config = getWarehouseConfig()

  sequelizeWarehouseInstance = new Sequelize(
    config.database,
    config.user,
    config.password,
    {
      host: config.host,
      port: config.port,
      dialect: 'postgres',
      logging: false,
      dialectOptions: config.ssl ? {
        ssl: {
          require: true,
          rejectUnauthorized: config.rejectUnauthorized,
        },
      } : {},
    }
  )

  return sequelizeWarehouseInstance
}

module.exports = {
  getWarehouseSequelize,
  isWarehouseConfigured,
}
