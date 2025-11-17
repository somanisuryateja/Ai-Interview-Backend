const express = require('express');
const Interview = require('../models/Interview');
const Resume = require('../models/Resume');
const AIService = require('../services/aiService');
const TTSService = require('../services/ttsService');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();
const aiService = new AIService();
const ttsService = new TTSService();

// Get all interviews for a user
router.get('/my-interviews', authMiddleware, async (req, res) => {
  try {
    const interviews = await Interview.find({ userId: req.user.userId })
      .sort({ scheduledDate: 1 })
      .populate('userId', 'name email');

    res.json({
      success: true,
      interviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interviews',
      error: error.message
    });
  }
});

// Get interview by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findOne({
      _id: req.params.id,
      userId: req.user.userId
    }).populate('userId', 'name email');

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    res.json({
      success: true,
      interview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interview',
      error: error.message
    });
  }
});

// Generate job descriptions for a role
router.post('/generate-job-descriptions', authMiddleware, async (req, res) => {
  try {
    const { jobRole, experienceLevel = 'mid-level' } = req.body;

    if (!jobRole) {
      return res.status(400).json({
        success: false,
        message: 'Job role is required'
      });
    }

    const prompt = `Generate exactly 3 different job descriptions for a ${jobRole} position at ${experienceLevel} level. 
    Each description should be:
    1. Professional and detailed
    2. Include key responsibilities
    3. Include required skills and qualifications
    4. Include company culture/benefits
    5. Be realistic and industry-standard
    
    Format as a JSON array with exactly 3 objects containing: title, company, description, requirements, benefits.
    
    Make each description unique with different company types (startup, enterprise, tech company, etc.)`;

    const result = await aiService.generateContent(prompt, {
      temperature: 0.8,
      maxOutputTokens: 2048
    });

    if (result.success) {
      try {
        // Clean the response text (remove markdown code blocks if present)
        let cleanText = result.text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Try to parse the JSON response
        const jobDescriptions = JSON.parse(cleanText);
        
        // Ensure we have exactly 3 descriptions
        if (Array.isArray(jobDescriptions) && jobDescriptions.length >= 3) {
          res.json({
            success: true,
            jobDescriptions: jobDescriptions.slice(0, 3)
          });
        } else {
          throw new Error('Invalid number of job descriptions');
        }
      } catch (parseError) {
        // If JSON parsing fails, return the raw text as a single description
        res.json({
          success: true,
          jobDescriptions: [{
            title: `${jobRole} Position`,
            company: 'Tech Company',
            description: result.text,
            requirements: 'See description above',
            benefits: 'Competitive package'
          }]
        });
      }
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to generate job descriptions',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Schedule a new interview
router.post('/schedule', authMiddleware, async (req, res) => {
  try {
    const {
      jobRole,
      jobDescription,
      duration,
      scheduledDate,
      scheduledTime,
      aiInstructions
    } = req.body;

    // Validate required fields
    if (!jobRole || !jobDescription || !duration || !scheduledDate || !scheduledTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate date is in the future
    const interviewDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (interviewDateTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Interview must be scheduled for a future date and time'
      });
    }

    // Check for conflicting interviews
    const existingInterview = await Interview.findOne({
      userId: req.user.userId,
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      status: { $in: ['scheduled', 'in-progress'] }
    });

    if (existingInterview) {
      return res.status(400).json({
        success: false,
        message: 'You already have an interview scheduled at this time'
      });
    }

    // Generate AI instructions based on job description
    let generatedInstructions = aiInstructions || '';
    if (!aiInstructions) {
      const instructionPrompt = `Generate specific AI interviewer instructions for a mock interview for a ${jobRole} position. 
      The job description is: ${jobDescription}
      
      Provide instructions for:
      1. Interview flow and structure
      2. Key areas to focus on
      3. Types of questions to ask
      4. Evaluation criteria
      5. Feedback approach
      
      Keep it concise but comprehensive.`;

      const instructionResult = await aiService.generateContent(instructionPrompt, {
        temperature: 0.7,
        maxOutputTokens: 1024
      });

      if (instructionResult.success) {
        generatedInstructions = instructionResult.text;
      }
    }

    // Create the interview
    const interview = new Interview({
      userId: req.user.userId,
      jobRole,
      jobDescription,
      duration: parseInt(duration),
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      aiInstructions: generatedInstructions
    });

    await interview.save();

    res.status(201).json({
      success: true,
      message: 'Interview scheduled successfully',
      interview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to schedule interview',
      error: error.message
    });
  }
});

// Update interview status
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const interview = await Interview.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      { status },
      { new: true }
    );

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    res.json({
      success: true,
      message: 'Interview status updated',
      interview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update interview status',
      error: error.message
    });
  }
});

// Update/edit an interview
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      jobRole,
      jobDescription,
      duration,
      scheduledDate,
      scheduledTime,
      aiInstructions
    } = req.body;

    const interview = await Interview.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Only allow editing scheduled interviews
    if (interview.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Can only edit scheduled interviews'
      });
    }

    // Update fields if provided
    if (jobRole) interview.jobRole = jobRole;
    if (jobDescription) interview.jobDescription = jobDescription;
    if (duration) interview.duration = parseInt(duration);
    if (scheduledDate) interview.scheduledDate = new Date(scheduledDate);
    if (scheduledTime) interview.scheduledTime = scheduledTime;
    if (aiInstructions !== undefined) interview.aiInstructions = aiInstructions;

    // Validate date is in the future if changed
    if (scheduledDate || scheduledTime) {
      const interviewDateTime = new Date(`${interview.scheduledDate}T${interview.scheduledTime}`);
      if (interviewDateTime <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Interview must be scheduled for a future date and time'
        });
      }
    }

    await interview.save();

    res.json({
      success: true,
      message: 'Interview updated successfully',
      interview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update interview',
      error: error.message
    });
  }
});

// Cancel an interview
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { status: 'cancelled' },
      { new: true }
    );

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    res.json({
      success: true,
      message: 'Interview cancelled successfully',
      interview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel interview',
      error: error.message
    });
  }
});

// Permanently delete an interview
router.delete('/:id/delete', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    res.json({
      success: true,
      message: 'Interview deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete interview',
      error: error.message
    });
  }
});

// Get user analytics
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get all interviews for the user
    const interviews = await Interview.find({ userId });
    
    // Calculate analytics
    const totalInterviews = interviews.length;
    const completedInterviews = interviews.filter(i => i.status === 'completed').length;
    const scheduledInterviews = interviews.filter(i => i.status === 'scheduled').length;
    const cancelledInterviews = interviews.filter(i => i.status === 'cancelled').length;
    
    // Calculate average score
    const completedWithScores = interviews.filter(i => i.status === 'completed' && i.score > 0);
    const averageScore = completedWithScores.length > 0 
      ? (completedWithScores.reduce((sum, i) => sum + i.score, 0) / completedWithScores.length).toFixed(1)
      : 0;
    
    // Get recent interviews (last 5)
    const recentInterviews = interviews
      .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate))
      .slice(0, 5)
      .map(interview => ({
        id: interview._id,
        title: interview.jobRole,
        date: interview.scheduledDate.toLocaleDateString(),
        status: interview.status,
        score: interview.score || 0
      }));

    res.json({
      success: true,
      analytics: {
        totalInterviews,
        completedInterviews,
        scheduledInterviews,
        cancelledInterviews,
        averageScore: parseFloat(averageScore),
        recentInterviews
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
      error: error.message
    });
  }
});

// Get available time slots for a date
router.get('/available-slots/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const { excludeInterviewId } = req.query; // Optional: exclude interview when editing
    const requestedDate = new Date(date);

    // Build query to exclude current interview if editing
    const query = {
      userId: req.user.userId,
      scheduledDate: {
        $gte: new Date(requestedDate.setHours(0, 0, 0, 0)),
        $lt: new Date(requestedDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['scheduled', 'in-progress'] }
    };

    if (excludeInterviewId) {
      query._id = { $ne: excludeInterviewId };
    }

    // Get existing interviews for this date
    const existingInterviews = await Interview.find(query);

    // Generate available time slots (9 AM to 6 PM, 30-minute intervals)
    const availableSlots = [];
    const startHour = 9;
    const endHour = 18;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const isBooked = existingInterviews.some(interview => interview.scheduledTime === timeString);
        
        if (!isBooked) {
          availableSlots.push(timeString);
        }
      }
    }

    res.json({
      success: true,
      availableSlots,
      date: requestedDate.toISOString().split('T')[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get available slots',
      error: error.message
    });
  }
});

// Stream AI interview response (for real-time interview chat)
router.post('/:id/ai-chat/stream', authMiddleware, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Get interview details
    const interview = await Interview.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Set up Server-Sent Events for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx

    // Fetch user's resume (get default or most recent)
    let resumeData = null;
    try {
      const resume = await Resume.findOne({ userId: req.user.userId })
        .sort({ isDefault: -1, lastModified: -1 })
        .limit(1);
      
      if (resume) {
        resumeData = {
          name: resume.name,
          email: resume.email,
          phone: resume.phone,
          location: resume.location,
          jobTitle: resume.jobTitle,
          summary: resume.summary,
          workExperience: resume.workExperience || [],
          education: resume.education || [],
          skills: resume.skills || []
        };
      }
    } catch (resumeError) {
      console.error('Error fetching resume:', resumeError);
      // Continue without resume data if fetch fails
    }

    const interviewContext = {
      jobRole: interview.jobRole,
      jobDescription: interview.jobDescription || '',
      aiInstructions: interview.aiInstructions || '',
      resume: resumeData
    };

    // Stream the response
    try {
      const streamGenerator = aiService.streamInterviewResponse(
        message,
        interviewContext,
        conversationHistory
      );

      for await (const chunk of streamGenerator) {
        // Send each chunk as SSE
        res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`);
      }

      // Signal completion
      res.write(`data: ${JSON.stringify({ chunk: '', done: true })}\n\n`);
      res.end();
    } catch (streamError) {
      console.error('Streaming error:', streamError);
      res.write(`data: ${JSON.stringify({ error: streamError.message, done: true })}\n\n`);
      res.end();
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stream AI response',
      error: error.message
    });
  }
});

// Generate AI response speech audio
router.post('/:id/ai-chat/tts', authMiddleware, async (req, res) => {
  try {
    const { text, language = 'en', slow = false } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Text is required to generate speech'
      });
    }

    const interview = await Interview.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    const speechResult = await ttsService.generateSpeech(text, { language, slow });
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.json({
      success: true,
      audioUrl: `${baseUrl}${speechResult.publicPath}`,
      metadata: {
        fileName: speechResult.fileName,
        size: speechResult.size,
        textLength: speechResult.textLength,
        truncated: speechResult.truncated,
        language
      }
    });
  } catch (error) {
    console.error('Error generating speech:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate speech audio',
      error: error.message
    });
  }
});

module.exports = router;
