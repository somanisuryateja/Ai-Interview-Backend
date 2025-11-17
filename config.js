module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
  DB_URL: process.env.DB_URL || 'mongodb://localhost:27017/framewise-clone',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173'
};
