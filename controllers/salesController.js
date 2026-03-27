const { getAllSalesReps, getSalesRepById } = require('../services/salesService');

const fetchAllSalesReps = async (req, res) => {
  try {
    const salesReps = await getAllSalesReps();

    res.status(200).json({
      success: true,
      data: salesReps,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales reps',
      error: error.message,
    });
  }
};

const fetchSalesRepById = async (req, res) => {
  try {
    const salesRep = await getSalesRepById(req.params.id);

    res.status(200).json({
      success: true,
      data: salesRep,
    });
  } catch (error) {
    const status = error.message === 'Sales rep not found' ? 404 : 500;

    res.status(status).json({
      success: false,
      message: error.message === 'Sales rep not found'
        ? 'Sales rep not found'
        : 'Failed to fetch sales rep',
      error: error.message,
    });
  }
};

module.exports = {
  fetchAllSalesReps,
  fetchSalesRepById,
};
