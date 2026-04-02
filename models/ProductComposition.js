const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelizeFourth');

const ProductComposition = sequelize.define('ProductComposition', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  ref_main_product: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  ref_compo_child_pro: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  compo_description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  compo_qty_child_unit: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: true,
  },
  compo_child_unit: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  pur_compo_qty_unit: {
    type: DataTypes.DECIMAL(18, 6),
    allowNull: true,
  },
  pur_compo_unit: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  compta: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  site: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'product_composition',
  timestamps: false,
});

module.exports = ProductComposition;
