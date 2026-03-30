const router = require('express').Router();
const {
  signIn,
  getAllUsers,
  getUserById,
  changePassword,
  forgotPassword,
  verifyResetPasswordToken,
  resetPasswordWithToken,
} = require('../controllers/userController');

router.post('/signin', signIn);
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', verifyResetPasswordToken);
router.patch('/reset-password/:token', resetPasswordWithToken);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.patch('/:id/change-password', changePassword);

module.exports = router;
