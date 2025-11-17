const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    
    // Fetch user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token. User not found.' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Account is deactivated.' 
      });
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      user: user
    };
    
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token.' 
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired.' 
      });
    }
    
    console.error('Auth middleware error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during authentication.' 
    });
  }
};

// Role-based access control middleware
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required.' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}` 
      });
    }

    next();
  };
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = {
          userId: decoded.userId,
          role: decoded.role,
          user: user
        };
      }
    }
    
    next();
  } catch (err) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Admin only middleware
const adminOnly = roleMiddleware(['admin']);

// Manager and Admin middleware
const managerAndAdmin = roleMiddleware(['manager', 'admin']);

// All authenticated users middleware
const authenticatedUser = roleMiddleware(['user', 'manager', 'admin']);

module.exports = {
  authMiddleware,
  roleMiddleware,
  optionalAuth,
  adminOnly,
  managerAndAdmin,
  authenticatedUser
};
