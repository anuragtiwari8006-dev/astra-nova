
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { comparePassword } = require('../middleware/auth');

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    if (user.role === 'admin') return res.redirect('/admin/dashboard');
    if (user.role === 'faculty') return res.redirect('/faculty/dashboard');
    if (user.role === 'student') return res.redirect('/student/dashboard');

    res.redirect('/');
  } catch (err) {
    res.status(500).send('Login Error: ' + err.message);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;