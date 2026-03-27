const express = require('express')
const multer = require('multer')
const controller = require('../controllers/stsForm.controller')

const router = express.Router()
const upload = multer()

router.post('/', upload.none(), controller.submitStsForm)
router.post('/access/:token', upload.none(), controller.submitStsFormByToken)
router.get('/access/:token', controller.getStsAccessByToken)
router.get('/ssr/:ssrId', controller.getStsFormBySsrId)

module.exports = router
