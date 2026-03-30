const userService = require('../services/userService');
const jwt = require('jsonwebtoken');

const respondWithControllerError = (res, error, fallbackMessage = 'Internal server error') => {
  const status = error.status || 500;
  return res.status(status).json({ success: false, message: error.message || fallbackMessage });
};

const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et password requis.' });
    }
    const data = await userService.signIn(email, password);
    return res.json({ success: true, data });
  } catch (err) {
    return respondWithControllerError(res, err, 'Unable to sign in.');
  }
};

const getAllUsers = async (req, res) => {
  try {
    const data = await userService.getAllUsers();
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    return respondWithControllerError(res, err);
  }
};

const getUserById = async (req, res) => {
  try {
    const data = await userService.getUserById(parseInt(req.params.id, 10));
    return res.json({ success: true, data });
  } catch (err) {
    return respondWithControllerError(res, err);
  }
};

const getAuthenticatedMemberId = (req) => {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    const err = new Error('Authentication required.');
    err.status = 401;
    throw err;
  }

  try {
    const token = header.slice(7).trim();
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return Number(payload?.id || 0);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Session expired. Please sign in again.');
      err.status = 401;
      throw err;
    }

    if (error.name === 'JsonWebTokenError') {
      const err = new Error('Invalid session. Please sign in again.');
      err.status = 401;
      throw err;
    }

    throw error;
  }
};

const changePassword = async (req, res) => {
  try {
    const memberId = parseInt(req.params.id, 10);
    const authenticatedMemberId = getAuthenticatedMemberId(req);
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Ancien et nouveau mot de passe requis.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit faire au moins 6 caractères.',
      });
    }

    if (authenticatedMemberId !== memberId) {
      return res.status(403).json({
        success: false,
        message: 'You can only change your own password.',
      });
    }

    const data = await userService.changePassword(memberId, oldPassword, newPassword);
    return res.json({ success: true, data });
  } catch (err) {
    return respondWithControllerError(res, err);
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const data = await userService.requestPasswordReset(email);
    return res.json({ success: true, ...data });
  } catch (err) {
    return respondWithControllerError(res, err, 'Unable to process forgot password request.');
  }
};

const verifyResetPasswordToken = async (req, res) => {
  try {
    const data = await userService.verifyResetPasswordRequest(req.params.token);
    return res.json({ success: true, data });
  } catch (err) {
    return respondWithControllerError(res, err, 'Invalid reset link.');
  }
};

const resetPasswordWithToken = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const data = await userService.resetPasswordWithToken(req.params.token, newPassword);
    return res.json({ success: true, ...data });
  } catch (err) {
    return respondWithControllerError(res, err, 'Unable to reset password.');
  }
};

module.exports = {
  signIn,
  getAllUsers,
  getUserById,
  changePassword,
  forgotPassword,
  verifyResetPasswordToken,
  resetPasswordWithToken,
};
