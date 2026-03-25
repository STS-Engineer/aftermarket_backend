const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const bcrypt        = require('bcryptjs');

const UserAuth = sequelize.define('UserAuth', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    comment: 'Reference to CompanyMemberAuth.id',
  },
    email: {                                        
    type:      DataTypes.STRING(255),
    allowNull: false,
    unique:    true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'user_auth',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: async (userAuth) => {
      if (userAuth.password && !userAuth.password.startsWith('$2a$') && !userAuth.password.startsWith('$2b$')) {
        userAuth.password = await bcrypt.hash(userAuth.password, 10);
      }
    },
    beforeUpdate: async (userAuth) => {
      if (userAuth.changed('password') && !userAuth.password.startsWith('$2a$') && !userAuth.password.startsWith('$2b$')) {
        userAuth.password = await bcrypt.hash(userAuth.password, 10);
      }
    },
  },
});

module.exports = UserAuth;