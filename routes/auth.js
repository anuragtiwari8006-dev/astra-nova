
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Render Login Page
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

// Handle User Login with Debug Logs
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`Attempting login for email: ${email}`);

    const user = await User.findOne({ email });
    if (!user) {
      console.log('Login failed: User not found in database.');
      return res.status(400).render('auth/login', { error: 'Invalid email or password' });
    }

    console.log(`User found! Role: ${user.role}`);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Password match result: ${isMatch}`);

    if (!isMatch) {
      console.log('Login failed: Password does not match.');
      return res.status(400).render('auth/login', { error: 'Invalid email or password' });
    }

    // Save session payload
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    // Redirect based on role
    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else if (user.role === 'faculty') {
      return res.redirect('/faculty/dashboard');
    } else {
      return res.redirect('/student/dashboard');
    }

  } catch (err) {
    console.error('Server Login Error:', err.message);
    res.status(500).send('Login Error: ' + err.message);
  }
});

// Logout Route
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;