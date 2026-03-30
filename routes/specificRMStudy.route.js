const express = require('express')
const multer = require('multer')
const controller = require('../controllers/specificRMStudy.controller')

const router = express.Router()
const upload = multer()

router.get('/access/:token', controller.getSpecificRMStudyAccessByToken)
router.post('/access/:token', upload.none(), controller.submitSpecificRMStudyFormByToken)

module.exports = router
