// models/SmallSerialRequest.js
const { DataTypes } = require("sequelize");
const sequelize     = require("../config/sequelize");
const FourMValidation = require("./fourMValidation.model");
const STSForm = require("./stsForm.model");

const SmallSerialRequest = sequelize.define(
  "SmallSerialRequest",
  {
    productReference: {
      type:      DataTypes.STRING,
      allowNull: false,
      field:     "product_reference",
    },
    referenceDesignation: {
      type:      DataTypes.TEXT,
      allowNull: false,
      field:     "reference_designation",
    },
    productFamily: {
      type:      DataTypes.STRING,
      allowNull: false,
      field:     "product_family",
    },
    customerName: {
      type:      DataTypes.STRING,
      allowNull: true,
      field:     "customer_name",
    },
    kamId: {
      type:       DataTypes.INTEGER,
      allowNull:  false,
      field:      "kam_id",
    },
    plant: {
      type: DataTypes.ENUM(
        'Tunisia Plant',
        'Kunshan Plant',
        'Monterrey Plant',
        'Tianjin Plant',
        'Chennai Plant',
        'Poitiers Plant',
        'Amiens Plant',
        'Anhui Plant',
        'Frankfurt Plant'
      ),
      allowNull: false,
      field:     "plant",
    },
    quantityRequested: {
      type:      DataTypes.INTEGER,
      allowNull: false,
      field:     "quantity_requested",
      validate:  { min: 1 },
    },
    dateRequested: {
      type:      DataTypes.DATE,
      allowNull: true,
      field:     "date_requested",
    },
    kamNote: {
      type:      DataTypes.TEXT,
      allowNull: true,
      field:     "kam_note",
    },
  },
  {
    tableName:   "small_serial_requests",
    underscored: true,
  }
);

SmallSerialRequest.hasOne(FourMValidation, {
  foreignKey: "ssrId",
  as: "fourMValidation",
});

SmallSerialRequest.hasOne(STSForm, {
  foreignKey: "ssrId",
  as: "stsForm",
});

module.exports = SmallSerialRequest;
