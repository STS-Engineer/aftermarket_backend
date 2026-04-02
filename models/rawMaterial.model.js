const { DataTypes } = require('sequelize')
const sequelize = require('../config/sequelize')

const RawMaterial = sequelize.define(
  'RawMaterial',
  {
    ssrId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'ssr_id',
      references: {
        model: 'small_serial_requests',
        key: 'id',
      },
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'order_index',
    },
    partReference: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'part_reference',
    },
    referenceDesignation: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'reference_designation',
    },
    quantityPerUnit: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'quantity_per_unit',
    },
    totalRequirement: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'total_requirement',
    },
    inventoryDateRm: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'inventory_date_rm',
    },
    rmCurrentStock: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'rm_current_stock',
    },
    rmAvailableForProd: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'rm_available_for_prod',
    },
    totalNeeds: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'total_needs',
    },
    lastSellingPrice: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'last_purchase_price',
    },
    lastSellingDate: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'last_purchasing_date',
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'status',
    },
    needStudyCase: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'need_study_case',
    },
  },
  {
    tableName: 'raw_materials',
    underscored: true,
    indexes: [
      {
        fields: ['ssr_id', 'order_index'],
      },
    ],
  }
)

module.exports = RawMaterial
