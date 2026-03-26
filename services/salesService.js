const SalesRep = require('../models/sales_reps');

const getAllSalesReps = async () => {
  try {
    const salesReps = await SalesRep.findAll({
      order: [['id', 'ASC']],
    });

    return salesReps;
  } catch (error) {
    throw new Error(`Error fetching sales reps: ${error.message}`);
  }
};

module.exports = {
  getAllSalesReps,
};