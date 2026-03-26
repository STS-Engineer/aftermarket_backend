const express = require('express');
const router = express.Router();

const { fetchAllSalesReps } = require('../controllers/salesController');

router.get('/', fetchAllSalesReps);

module.exports = router;