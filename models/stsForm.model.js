const { DataTypes } = require('sequelize')
const sequelize = require('../config/sequelize')

const STSForm = sequelize.define(
  'STSForm',
  {
    ssrId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'ssr_id',
      references: {
        model: 'small_serial_requests',
        key: 'id',
      },
    },
    productCurrentStock: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'product_current_stock',
    },
    lastSellingPrice: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'last_selling_price',
    },
    lastSellingDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'last_selling_date',
    },
    rawMaterials: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'raw_materials',
    },
  },
  {
    tableName: 'sts_forms',
    underscored: true,
  }
)

module.exports = STSForm
