const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  jobTitle: {
    type: String,
    trim: true
  },
  summary: {
    type: String,
    trim: true
  },
  workExperience: [{
    title: String,
    company: String,
    duration: String,
    description: String,
    location: String
  }],
  education: [{
    degree: String,
    institution: String,
    duration: String,
    description: String,
    location: String
  }],
  skills: [String],
  themeColor: {
    type: String,
    default: '#3b82f6'
  },
  fontSize: {
    type: Number,
    default: 11
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
resumeSchema.index({ userId: 1 });
resumeSchema.index({ userId: 1, isDefault: 1 });

// Virtual for formatted last modified date
resumeSchema.virtual('formattedLastModified').get(function() {
  return this.lastModified.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Method to update last modified date
resumeSchema.methods.updateLastModified = function() {
  this.lastModified = new Date();
  return this.save();
};

const Resume = mongoose.model('Resume', resumeSchema);

module.exports = Resume;
