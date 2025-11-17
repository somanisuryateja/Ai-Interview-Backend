const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// User Registration (Sign-Up)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Validate role
    const allowedRoles = ['user', 'manager', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Allowed roles: user, manager, admin'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser._id, 
        role: newUser.role,
        email: newUser.email
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: newUser.fullProfile
    });

  } catch (err) {
    console.error('Registration error:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: user.role,
        email: user.email
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: user.fullProfile
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      user: req.user.user.fullProfile
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving profile'
    });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, profile } = req.body;
    const userId = req.user.userId;

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (profile) updateData.profile = { ...req.user.user.profile, ...profile };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser.fullProfile
    });

  } catch (err) {
    console.error('Profile update error:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
});

// Change password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const user = await User.findById(userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error changing password'
    });
  }
});

// User logout (client-side token removal)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Verify token endpoint
router.get('/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user.user.fullProfile
  });
});

module.exports = router;
