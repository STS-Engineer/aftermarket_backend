const SmallSerialRequest = require('../models/ssr.model')


const createSmallSerialRequest = async (data) => {
  return await SmallSerialRequest.create(data)
}

const getAllSmallSerialRequests = async () => {
  return await SmallSerialRequest.findAll({
    order: [['createdAt', 'DESC']]
  })
}

const getSmallSerialRequestById = async (id) => {
  const request = await SmallSerialRequest.findByPk(id)
  if (!request) throw new Error('SmallSerialRequest not found')
  return request
}

const updateSmallSerialRequest = async (id, data) => {
  const request = await SmallSerialRequest.findByPk(id)
  if (!request) throw new Error('SmallSerialRequest not found')
  return await request.update(data)
}

const deleteSmallSerialRequest = async (id) => {
  const request = await SmallSerialRequest.findByPk(id)
  if (!request) throw new Error('SmallSerialRequest not found')
  await request.destroy()
  return { message: 'SmallSerialRequest deleted successfully' }
}

module.exports = {
  createSmallSerialRequest,
  getAllSmallSerialRequests,
  getSmallSerialRequestById,
  updateSmallSerialRequest,
  deleteSmallSerialRequest,
}