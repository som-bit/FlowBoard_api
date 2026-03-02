const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// POST: /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create the user
    const newUser = new User({
      name,
      email,
      passwordHash
    });

    const savedUser = await newUser.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Token lasts for a week
    );

    res.status(201).json({
      token,
      user: { id: savedUser._id, name: savedUser.name, email: savedUser.email }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST: /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});



// GET /api/auth/me
// Returns current user details based on the JWT token


// router.get('/profile', async (req, res) => {
//   try {
//     // req.user.id is usually populated by your authMiddleware after decoding the JWT
//     const user = await User.findById(req.user.id).select('-password');
    
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     res.json({
//       id: user._id,
//       name: user.name,
//       email: user.email
//     });
//   } catch (error) {
//     res.status(500).json({ error: "Server error fetching user details" });
//   }
// });




router.get('/profile', async (req, res) => {
  try {
    // 1. Get token from header
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // 2. Verify token directly
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Fetch user details from MongoDB using ID from token
    // We use .select('-passwordHash') to ensure the password isn't sent to the frontend
    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 4. Return real data
    res.json({
      id: user._id,
      name: user.name,
      email: user.email
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token is not valid' });
    }
    console.error('Profile Fetch Error:', error);
    res.status(500).json({ error: "Server error fetching user details" });
  }
});

module.exports = router;






module.exports = router;