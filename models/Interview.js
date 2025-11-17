const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobRole: {
    type: String,
    required: true,
    trim: true
  },
  jobDescription: {
    type: String,
    required: true
  },
  interviewType: {
    type: String,
    default: 'mixed'
  },
  duration: {
    type: Number,
    required: true,
    min: 15,
    max: 180 // Maximum 3 hours
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  interviewRoomId: {
    type: String,
    unique: true,
    sparse: true
  },
  aiInstructions: {
    type: String,
    default: ''
  },
  feedback: {
    type: String,
    default: ''
  },
  score: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient queries
interviewSchema.index({ userId: 1, scheduledDate: 1 });
interviewSchema.index({ status: 1 });
interviewSchema.index({ interviewRoomId: 1 });

// Generate unique interview room ID
interviewSchema.pre('save', function(next) {
  if (!this.interviewRoomId) {
    this.interviewRoomId = `room_${this._id}_${Date.now()}`;
  }
  next();
});

// Virtual for formatted date
interviewSchema.virtual('formattedDate').get(function() {
  return this.scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for formatted time
interviewSchema.virtual('formattedTime').get(function() {
  return this.scheduledTime;
});

// Virtual for duration in minutes
interviewSchema.virtual('durationText').get(function() {
  if (this.duration < 60) {
    return `${this.duration} minutes`;
  } else {
    const hours = Math.floor(this.duration / 60);
    const minutes = this.duration % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
});

const Interview = mongoose.model('Interview', interviewSchema);

module.exports = Interview;
