const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelizeSecond');

const CompanyMember = sequelize.define('CompanyMember', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  display_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  job_title: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  department: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  site: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  account_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  manager_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  manager_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  depth: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  synced_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'company_members',
  timestamps: true,
  underscored: true,
});

module.exports = CompanyMember;