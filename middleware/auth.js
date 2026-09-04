
const bcrypt = require('bcryptjs');

const isAuthenticated = (req, res, next) => {
  if ((req.session && req.session.user) || req.user) {
    return next();
  }
  return res.redirect('/auth/login');
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    const currentUser = (req.session && req.session.user) || req.user;
    if (!currentUser) {
      return res.redirect('/auth/login');
    }
    if (!roles.includes(currentUser.role)) {
      return res.status(403).send('Access Denied: You do not have permission.');
    }
    next();
  };
};

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

const comparePassword = async (enteredPassword, storedHashedPassword) => {
  return await bcrypt.compare(enteredPassword, storedHashedPassword);
};

module.exports = {
  isAuthenticated,
  authorizeRoles,
  hashPassword,
  comparePassword
};