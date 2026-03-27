const express = require('express');
const router = express.Router();

const { fetchAllSalesReps, fetchSalesRepById } = require('../controllers/salesController');

router.get('/', fetchAllSalesReps);
router.get('/:id', fetchSalesRepById);

module.exports = router;
