const { getAllSalesReps } = require('../services/salesService');

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

module.exports = {
  fetchAllSalesReps,
};