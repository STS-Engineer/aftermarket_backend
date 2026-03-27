const { DataTypes } = require('sequelize')
const sequelize = require('../config/sequelize')

const FourMValidation = sequelize.define(
  'FourMValidation',
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
    machineOk: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'machine_ok',
    },
    machineExplanation: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'machine_explanation',
    },
    machineDueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'machine_due_date',
    },
    methodOk: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'method_ok',
    },
    methodExplanation: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'method_explanation',
    },
    methodDueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'method_due_date',
    },
    laborOk: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'labor_ok',
    },
    laborExplanation: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'labor_explanation',
    },
    laborDueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'labor_due_date',
    },
    environmentOk: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'environment_ok',
    },
    environmentExplanation: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'environment_explanation',
    },
    environmentDueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'environment_due_date',
    },
    productionCapacityPerWeek: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'production_capacity_per_week',
      validate: { min: 1 },
    },
    documentName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'document_name',
    },
    documentMimeType: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'document_mime_type',
    },
    documentSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'document_size',
    },
    documentData: {
      type: DataTypes.BLOB('long'),
      allowNull: false,
      field: 'document_data',
    },
  },
  {
    tableName: 'four_m_validations',
    underscored: true,
  }
)

module.exports = FourMValidation
