const userService = require('../services/userService');

const signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et password requis.' });
    }
    const data = await userService.signIn(email, password);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getAllUsers = async (req, res, next) => {
  try {
    const data = await userService.getAllUsers();
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

const getUserById = async (req, res, next) => {
  try {
    const data = await userService.getUserById(parseInt(req.params.id, 10));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const memberId = parseInt(req.params.id, 10);
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

    const data = await userService.changePassword(memberId, oldPassword, newPassword);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

module.exports = { signIn, getAllUsers, getUserById, changePassword };
