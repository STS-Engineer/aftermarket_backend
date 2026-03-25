require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./config/sequelize");
const ssrRoutes = require("./routes/ssr.route");
const userRoutes = require("./routes/userRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

app.get("/api/data", (req, res) => {
  res.json({ message: "Hello from backend 👋" });
});

app.use("/api/ssr", ssrRoutes);

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL connected successfully");

    await sequelize.sync();
    console.log("Models synchronized successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Unable to connect to PostgreSQL:", error.message);
    process.exit(1);
  }
}

startServer();