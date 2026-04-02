const {
  getRawMaterialMetricsByInternalReferences,
} = require('../services/rawMaterialMetrics.service')
const RawMaterial = require('../models/rawMaterial.model')
const ssrService = require('../services/ssr.service')
const stsFormService = require('../services/stsForm.service')

const parseInternalReferences = (value) => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry || '').split(','))
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const fetchRawMaterialMetrics = async (req, res) => {
  try {
    const ssrIdValue = req.query.ssrId || req.query.ssr_id || req.params.ssrId || req.params.id

    if (ssrIdValue !== undefined) {
      const ssrId = Number(ssrIdValue)

      if (!Number.isInteger(ssrId) || ssrId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'ssrId must be a positive integer',
        })
      }

      const accessData = await stsFormService.getSpecificRMStudyAccessDataBySsrId(ssrId)
      const savedRawMaterials = await RawMaterial.findAll({
        where: { ssrId },
        order: [['orderIndex', 'ASC']],
      })
      const rawMaterials = ssrService.mergeRMAvailabilityRawMaterials(
        Array.isArray(accessData?.rawMaterials) ? accessData.rawMaterials : [],
        savedRawMaterials
      )
      
      return res.status(200).json({
        success: true,
        ssrId,
        count: rawMaterials.length,
        data: rawMaterials,
      })
    }

    const internalReferences = parseInternalReferences(req.query.internalReferences || req.query.refs)

    if (internalReferences.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'internalReferences or ssrId query parameter is required',
      })
    }

    const metricsByReference = await getRawMaterialMetricsByInternalReferences(internalReferences)
    const data = internalReferences.map((internalReference) => {
      const metrics = metricsByReference.get(internalReference) || {}

      return {
        internalReference,
        lastInventoryQuantity: metrics.lastInventoryQuantity || '',
        lastInventoryDate: metrics.lastInventoryDate || '',
        lastMovementPrice: metrics.lastMovementPrice || '',
        lastMovementDate: metrics.lastMovementDate || '',
        rmCurrentStock: metrics.rmCurrentStock || '',
        lastSellingPrice: metrics.lastSellingPrice || '',
        lastSellingDate: metrics.lastSellingDate || '',
      }
    })

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    })
  } catch (error) {
    const status = error.message === 'SmallSerialRequest not found' ? 404 : 500

    return res.status(status).json({
      success: false,
      message: status === 404 ? 'SmallSerialRequest not found' : 'Failed to fetch raw material metrics',
      error: error.message,
    })
  }
}

module.exports = {
  fetchRawMaterialMetrics,
}
