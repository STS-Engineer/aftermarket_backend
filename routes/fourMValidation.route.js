const express = require('express')
const fs = require('fs')
const multer = require('multer')
const path = require('path')
const controller = require('../controllers/fourMValidation.controller')
const { buildStoredUploadFileName } = require('../utils/uploadFileName')

const router = express.Router()
const uploadDir = path.join(__dirname, '..', 'upload', '4M')
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

router.post('/', upload.single('document'), controller.createFourMValidation)
router.post('/access/:token', upload.single('document'), controller.createFourMValidationByToken)
router.get('/access/:token', controller.getSmallSerialRequestForFourMByToken)
router.get('/ssr/:ssrId', controller.getFourMValidationBySsrId)

module.exports = router
