const express = require('express');
const User = require('../models/User');
const { authMiddleware, adminOnly, managerAndAdmin, authenticatedUser } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/users - Get all users (Admin and Manager only)
router.get('/', authMiddleware, managerAndAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving users'
    });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Users can only view their own profile unless they're admin/manager
    if (currentUser.role === 'user' && currentUser.userId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own profile.'
      });
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User retrieved successfully',
      user: user.fullProfile
    });

  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user'
    });
  }
});

// POST /api/users - Create new user (Admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
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

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser.fullProfile
    });

  } catch (err) {
    console.error('Create user error:', err);
    
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
      message: 'Server error creating user'
    });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, profile } = req.body;
    const currentUser = req.user;

    // Users can only update their own profile (except role and isActive)
    if (currentUser.role === 'user' && currentUser.userId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own profile.'
      });
    }

    // Only admins can change roles and active status
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (profile) updateData.profile = profile;

    if (currentUser.role === 'admin') {
      if (role) updateData.role = role;
      if (typeof isActive === 'boolean') updateData.isActive = isActive;
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser.fullProfile
    });

  } catch (err) {
    console.error('Update user error:', err);
    
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
      message: 'Server error updating user'
    });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.userId === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error deleting user'
    });
  }
});

// GET /api/users/stats/dashboard - Get user statistics (Admin only)
router.get('/stats/dashboard', authMiddleware, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const recentUsers = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      message: 'Dashboard stats retrieved successfully',
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        usersByRole,
        recentUsers: recentUsers.map(user => user.fullProfile)
      }
    });

  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving dashboard stats'
    });
  }
});

module.exports = router;
