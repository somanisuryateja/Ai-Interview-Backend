const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb+srv://suryaUser:Surya123%402025@suryacluster.hxsysgp.mongodb.net/framewise-clone';
console.log('🔍 Connecting to MongoDB:', mongoUri);

mongoose.connect(mongoUri, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Framewise Clone Backend API',
    status: 'Server is running successfully!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Server is healthy',
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/interviews', require('./routes/interviewRoutes'));
app.use('/api/resumes', require('./routes/resumeRoutes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
});

module.exports = app;
