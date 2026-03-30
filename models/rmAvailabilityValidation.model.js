const { DataTypes } = require('sequelize')
const sequelize = require('../config/sequelize')

const RMAvailabilityValidation = sequelize.define(
  'RMAvailabilityValidation',
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
    approvalDocumentName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'approval_document_name',
    },
    approvalDocumentMimeType: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'approval_document_mime_type',
    },
    approvalDocumentSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'approval_document_size',
    },
    approvalDocumentData: {
      type: DataTypes.BLOB('long'),
      allowNull: false,
      field: 'approval_document_data',
    },
  },
  {
    tableName: 'rm_availability_validations',
    underscored: true,
  }
)

module.exports = RMAvailabilityValidation
