const { Sequelize } = require("sequelize");

const host = process.env.DB_HOST || "";
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(host);
const useSSL = process.env.DB_SSL
  ? String(process.env.DB_SSL).toLowerCase() === "true"
  : !isLocalHost;
const rejectUnauthorized =
  String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false").toLowerCase() ===
  "true";

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
    dialectOptions: useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized
          }
        }
      : {}
  }
);

module.exports = sequelize;