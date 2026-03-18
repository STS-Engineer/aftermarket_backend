const service = require('../services/ssr.service')

const createSmallSerialRequest = async (req, res) => {
  try {
    const {
      productReference,
      referenceDesignation,
      productFamily,
      customerName,
      kam,
      plant,
      quantityRequested,
      dateRequested,
      kamNote,
    } = req.body

    const missing = []
    if (!productReference)     missing.push('productReference')
    if (!referenceDesignation) missing.push('referenceDesignation')
    if (!productFamily)        missing.push('productFamily')
    if (!kam)                  missing.push('kam')
    if (!plant)                missing.push('plant')
    if (!quantityRequested)    missing.push('quantityRequested')

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(', ')}`
      })
    }

    if (Number(quantityRequested) < 1) {
      return res.status(400).json({ message: 'quantityRequested must be at least 1' })
    }

    const data = await service.createSmallSerialRequest({
      productReference,
      referenceDesignation,
      productFamily,
      customerName:      customerName    || null,
      kam,
      plant,
      quantityRequested: Number(quantityRequested),
      dateRequested:     dateRequested   || null,
      kamNote:           kamNote         || null,
    })

    return res.status(201).json(data)
  } catch (error) {
    console.error('createSmallSerialRequest error:', error)
    return res.status(500).json({ message: error.message || 'Internal server error' })
  }
}

const getAllSmallSerialRequests = async (req, res) => {
  try {
    const data = await service.getAllSmallSerialRequests()
    return res.status(200).json(data)
  } catch (error) {
    console.error('getAllSmallSerialRequests error:', error)
    return res.status(500).json({ message: error.message || 'Internal server error' })
  }
}

const getSmallSerialRequestById = async (req, res) => {
  try {
    const data = await service.getSmallSerialRequestById(req.params.id)
    return res.status(200).json(data)
  } catch (error) {
    console.error('getSmallSerialRequestById error:', error)
    const status = error.message === 'SmallSerialRequest not found' ? 404 : 500
    return res.status(status).json({ message: error.message || 'Internal server error' })
  }
}

const updateSmallSerialRequest = async (req, res) => {
  try {
    const data = await service.updateSmallSerialRequest(req.params.id, req.body)
    return res.status(200).json(data)
  } catch (error) {
    console.error('updateSmallSerialRequest error:', error)
    const status = error.message === 'SmallSerialRequest not found' ? 404 : 500
    return res.status(status).json({ message: error.message || 'Internal server error' })
  }
}

const deleteSmallSerialRequest = async (req, res) => {
  try {
    const data = await service.deleteSmallSerialRequest(req.params.id)
    return res.status(200).json(data)
  } catch (error) {
    console.error('deleteSmallSerialRequest error:', error)
    const status = error.message === 'SmallSerialRequest not found' ? 404 : 500
    return res.status(status).json({ message: error.message || 'Internal server error' })
  }
}

module.exports = {
  createSmallSerialRequest,
  getAllSmallSerialRequests,
  getSmallSerialRequestById,
  updateSmallSerialRequest,
  deleteSmallSerialRequest,
}