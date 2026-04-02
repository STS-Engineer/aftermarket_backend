const express = require('express')

const { fetchRawMaterialMetrics } = require('../controllers/rawMaterialMetrics.controller')

const router = express.Router()

router.get('/', fetchRawMaterialMetrics)
router.get('/:id', fetchRawMaterialMetrics)
router.get('/ssr/:ssrId', fetchRawMaterialMetrics)

module.exports = router
