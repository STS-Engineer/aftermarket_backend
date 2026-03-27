const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/ssr.controller')

router.post('/',      ctrl.createSmallSerialRequest)

router.get('/',       ctrl.getAllSmallSerialRequests)

router.get('/access/:token', ctrl.getSmallSerialRequestForStsByToken)

router.get('/:id',    ctrl.getSmallSerialRequestById)

router.put('/:id',    ctrl.updateSmallSerialRequest)

router.delete('/:id', ctrl.deleteSmallSerialRequest)

module.exports = router
