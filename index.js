require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const sequelize = require("./config/sequelize");
const ssrRoutes = require("./routes/ssr.route");
const fourMValidationRoutes = require("./routes/fourMValidation.route");
const stsFormRoutes = require("./routes/stsForm.route");
const specificRMStudyRoutes = require('./routes/specificRMStudy.route');
const productInventoryValidationRoutes = require("./routes/productInventoryValidation.route");
const rmAvailabilityValidationRoutes = require('./routes/rmAvailabilityValidation.route');
const userRoutes = require("./routes/userRoutes");
const salesRoutes = require('./routes/salesRoutes');
const rawMaterialMetricsRoutes = require('./routes/rawMaterialMetrics.route');

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", userRoutes);
app.use("/upload", express.static(path.join(__dirname, "upload")));
app.use("/api/upload", express.static(path.join(__dirname, "upload")));

app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

app.get("/api/data", (req, res) => {
  res.json({ message: "Hello from backend 👋" });
});

app.use("/api/ssr", ssrRoutes);
app.use("/api/4m-validations", fourMValidationRoutes);
app.use("/api/sts-forms", stsFormRoutes);
app.use("/api/sts-form", stsFormRoutes);
app.use("/api/sts", stsFormRoutes);
app.use("/api/sts-validations", stsFormRoutes);
app.use('/api/specific-rm-study', specificRMStudyRoutes);
app.use('/api/specific-rm-study-form', specificRMStudyRoutes);
app.use("/api/product-inventory-validations", productInventoryValidationRoutes);
app.use('/api/rm-availability-validations', rmAvailabilityValidationRoutes);
app.use('/api/sales-reps', salesRoutes);
app.use('/api/raw-material-metrics', rawMaterialMetricsRoutes);
app.use('/api/raw-materials', rawMaterialMetricsRoutes);

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL connected successfully");

    await sequelize.query('ALTER TABLE IF EXISTS raw_materials ADD COLUMN IF NOT EXISTS status BOOLEAN DEFAULT TRUE');
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
