// Environment Configuration
// Copy the values to your .env file

const config = {
  // Server Configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database Configuration
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/framewise-clone',

  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // CORS Configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Email Configuration (for future use)
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: process.env.EMAIL_PORT || 587,
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',

  // File Upload Configuration
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 5242880, // 5MB
  UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || 100,

  // Password Configuration
  BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || 12,

  // Pagination
  DEFAULT_PAGE_SIZE: process.env.DEFAULT_PAGE_SIZE || 10,
  MAX_PAGE_SIZE: process.env.MAX_PAGE_SIZE || 100
};

module.exports = config;
