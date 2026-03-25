const router = require('express').Router();
const {
  signIn,
  getAllUsers,
  getUserById,
  changePassword,
} = require('../controllers/userController');

router.post('/signin', signIn);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.patch('/:id/change-password', changePassword);

module.exports = router;
