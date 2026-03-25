const  CompanyMember  = require('../models/User'); 
const  UserAuth       = require('../models/UserAuth');       
const bcrypt            = require('bcryptjs');
const jwt               = require('jsonwebtoken');

async function getAllUsers() {
  return CompanyMember.findAll({
    attributes: { exclude: [] },
    order: [['last_name', 'ASC'], ['first_name', 'ASC']],
  });
}

async function signIn(email, password) {
  const member = await CompanyMember.findOne({ where: { email } });

  console.log(`Tentative de connexion pour ${email} : ${member ? 'Membre trouvé' : 'Membre non trouvé'}`);

  if (!member) {
    const err = new Error('Email ou mot de passe incorrect.');
    err.status = 401;
    throw err;
  }

  const userAuth = await UserAuth.findOne({ where: { member_id: member.id } });

  if (!userAuth) {
    const err = new Error('Ce compte ne dispose pas d\'un mot de passe local.');
    err.status = 403;
    throw err;
  }

  const valid = await bcrypt.compare(password, userAuth.password);
  if (!valid) {
    const err = new Error('Email ou mot de passe incorrect.');
    err.status = 401;
    throw err;
  }

  const token = jwt.sign(
    {
      id:           member.id,
      email:        member.email,
      account_type: member.account_type,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );

  return {
    token,
    member: {
      id:           member.id,
      display_name: member.display_name,
      first_name:   member.first_name,
      last_name:    member.last_name,
      email:        member.email,
      job_title:    member.job_title,
      department:   member.department,
      account_type: member.account_type,
    },
  };
}

async function getUserById(id) {
  const member = await CompanyMember.findByPk(id);

  if (!member) {
    const err = new Error(`Membre #${id} introuvable.`);
    err.status = 404;
    throw err;
  }

  return {
    id:           member.id,
    display_name: member.display_name,
    first_name:   member.first_name,
    last_name:    member.last_name,
    email:        member.email,
    job_title:    member.job_title,
    department:   member.department,
    site:         member.site,
    country:      member.country,
    account_type: member.account_type,
    manager_id:   member.manager_id,
    manager_email: member.manager_email,
    depth:        member.depth,
  };
}

async function changePassword(memberId, oldPassword, newPassword) {
  const member = await CompanyMember.findByPk(memberId);
  if (!member) {
    const err = new Error(`Membre #${memberId} introuvable.`);
    err.status = 404;
    throw err;
  }

  const userAuth = await UserAuth.findOne({ where: { member_id: memberId } });
  if (!userAuth) {
    const err = new Error('Aucun mot de passe local trouvé pour ce compte.');
    err.status = 404;
    throw err;
  }

  const valid = await bcrypt.compare(oldPassword, userAuth.password);
  if (!valid) {
    const err = new Error('Ancien mot de passe incorrect.');
    err.status = 401;
    throw err;
  }

  await userAuth.update({ password: newPassword });

  return { message: 'Mot de passe mis à jour avec succès.' };
}

module.exports = {
  getAllUsers,
  getUserById,
  signIn,
  changePassword,
};