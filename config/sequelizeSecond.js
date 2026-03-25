const { Sequelize } = require('sequelize');

const sequelizeSecond = new Sequelize(
  process.env.DB2_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require:            true,
        rejectUnauthorized: false, 
      },
    },
  }
);

module.exports = sequelizeSecond;