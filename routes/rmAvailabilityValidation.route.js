const express = require('express')
const fs = require('fs')
const multer = require('multer')
const path = require('path')
const controller = require('../controllers/rmAvailabilityValidation.controller')
const { buildStoredUploadFileName } = require('../utils/uploadFileName')

const router = express.Router()
const uploadDir = path.join(__dirname, '..', 'upload', 'rm-availability-validation')
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, buildStoredUploadFileName(file.originalname))
  },
})
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

router.post('/', upload.single('document'), controller.submitRMAvailabilityValidation)
router.post('/access/:token', upload.single('document'), controller.submitRMAvailabilityValidationByToken)
router.get('/access/:token', controller.getRMAvailabilityAccessByToken)
router.get('/ssr/:ssrId', controller.getRMAvailabilityValidationBySsrId)

module.exports = router
