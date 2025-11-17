const express = require('express');
const AIService = require('../services/aiService');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();
const aiService = new AIService();

// Test AI connection
router.get('/test', authMiddleware, async (req, res) => {
  try {
    const result = await aiService.generateContent('Hello! Respond with "AI is working" if you can see this message.');
    
    if (result.success) {
      res.json({
        success: true,
        message: 'AI service is working',
        response: result.text
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'AI service error',
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

// Generate interview questions
router.post('/interview-questions', authMiddleware, async (req, res) => {
  try {
    const { role, experience, count = 5 } = req.body;
    
    if (!role || !experience) {
      return res.status(400).json({
        success: false,
        message: 'Role and experience are required'
      });
    }

    const result = await aiService.generateInterviewQuestions(role, experience, count);
    
    if (result.success) {
      res.json({
        success: true,
        questions: result.text,
        usage: result.usage
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to generate questions',
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

// Analyze resume
router.post('/analyze-resume', authMiddleware, async (req, res) => {
  try {
    const { resumeText } = req.body;
    
    if (!resumeText) {
      return res.status(400).json({
        success: false,
        message: 'Resume text is required'
      });
    }

    const result = await aiService.analyzeResume(resumeText);
    
    if (result.success) {
      res.json({
        success: true,
        analysis: result.text,
        usage: result.usage
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to analyze resume',
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

// Generate interview feedback
router.post('/interview-feedback', authMiddleware, async (req, res) => {
  try {
    const { answers, questions } = req.body;
    
    if (!answers || !questions) {
      return res.status(400).json({
        success: false,
        message: 'Answers and questions are required'
      });
    }

    const result = await aiService.generateInterviewFeedback(answers, questions);
    
    if (result.success) {
      res.json({
        success: true,
        feedback: result.text,
        usage: result.usage
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to generate feedback',
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

// Code review
router.post('/code-review', authMiddleware, async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Code and language are required'
      });
    }

    const result = await aiService.reviewCode(code, language);
    
    if (result.success) {
      res.json({
        success: true,
        review: result.text,
        usage: result.usage
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to review code',
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

// General chat
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const result = await aiService.chat(message, context);
    
    if (result.success) {
      res.json({
        success: true,
        response: result.text,
        usage: result.usage
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to process chat',
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

module.exports = router;
