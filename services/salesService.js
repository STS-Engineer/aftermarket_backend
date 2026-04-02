const SalesRep = require('../models/sales_reps');
const { formatSalesRep } = require('../utils/salesRep')

const getAllSalesReps = async () => {
  try {
    const salesReps = await SalesRep.findAll({
      order: [['full_name', 'ASC'], ['id', 'ASC']],
    });

    return salesReps.map(formatSalesRep)
  } catch (error) {
    throw new Error(`Error fetching sales reps: ${error.message}`);
  }
};

const getSalesRepById = async (id) => {
  try {
    const salesRep = await SalesRep.findByPk(id);

    if (!salesRep) {
      throw new Error('Sales rep not found');
    }

    return formatSalesRep(salesRep)
  } catch (error) {
    if (error.message === 'Sales rep not found') {
      throw error;
    }

    throw new Error(`Error fetching sales rep: ${error.message}`);
  }
};

module.exports = {
  getAllSalesReps,
  getSalesRepById,
};
