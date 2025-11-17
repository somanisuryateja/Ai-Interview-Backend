const express = require('express');
const Resume = require('../models/Resume');
const { authMiddleware } = require('../middleware/authMiddleware');
const pdfService = require('../services/pdfService');
const pdfTextExtractor = require('../services/pdfTextExtractor');
const advancedATSAnalyzer = require('../services/advancedATSAnalyzer');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'temp'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + '.pdf');
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Get all resumes for a user
router.get('/my-resumes', authMiddleware, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user.userId })
      .sort({ lastModified: -1 })
      .populate('userId', 'name email');

    res.json({
      success: true,
      resumes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resumes',
      error: error.message
    });
  }
});

// Get a specific resume by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.user.userId
    }).populate('userId', 'name email');

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    res.json({
      success: true,
      resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resume',
      error: error.message
    });
  }
});

// Create a new resume
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      location,
      jobTitle,
      summary,
      workExperience,
      education,
      skills,
      themeColor,
      fontSize,
      isDefault
    } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    // If this is set as default, unset other defaults for this user
    if (isDefault) {
      await Resume.updateMany(
        { userId: req.user.userId },
        { isDefault: false }
      );
    }

    // Create the resume
    const resume = new Resume({
      userId: req.user.userId,
      name,
      email,
      phone,
      location,
      jobTitle,
      summary,
      workExperience: workExperience || [],
      education: education || [],
      skills: skills || [],
      themeColor: themeColor || '#3b82f6',
      fontSize: fontSize || 11,
      isDefault: isDefault || false
    });

    await resume.save();

    res.status(201).json({
      success: true,
      message: 'Resume created successfully',
      resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create resume',
      error: error.message
    });
  }
});

// Update an existing resume
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      location,
      jobTitle,
      summary,
      workExperience,
      education,
      skills,
      themeColor,
      fontSize,
      isDefault
    } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    // If this is set as default, unset other defaults for this user
    if (isDefault) {
      await Resume.updateMany(
        { userId: req.user.userId, _id: { $ne: req.params.id } },
        { isDefault: false }
      );
    }

    // Update the resume
    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      {
        name,
        email,
        phone,
        location,
        jobTitle,
        summary,
        workExperience: workExperience || [],
        education: education || [],
        skills: skills || [],
        themeColor: themeColor || '#3b82f6',
        fontSize: fontSize || 11,
        isDefault: isDefault || false,
        lastModified: new Date()
      },
      { new: true }
    );

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    res.json({
      success: true,
      message: 'Resume updated successfully',
      resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update resume',
      error: error.message
    });
  }
});

// Save resume (create or update)
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const {
      resumeId,
      name,
      email,
      phone,
      location,
      jobTitle,
      summary,
      workExperience,
      education,
      skills,
      themeColor,
      fontSize,
      isDefault
    } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    let resume;

    if (resumeId) {
      // Update existing resume
      // If this is set as default, unset other defaults for this user
      if (isDefault) {
        await Resume.updateMany(
          { userId: req.user.userId, _id: { $ne: resumeId } },
          { isDefault: false }
        );
      }

      resume = await Resume.findOneAndUpdate(
        { _id: resumeId, userId: req.user.userId },
        {
          name,
          email,
          phone,
          location,
          jobTitle,
          summary,
          workExperience: workExperience || [],
          education: education || [],
          skills: skills || [],
          themeColor: themeColor || '#3b82f6',
          fontSize: fontSize || 11,
          isDefault: isDefault || false,
          lastModified: new Date()
        },
        { new: true }
      );

      if (!resume) {
        return res.status(404).json({
          success: false,
          message: 'Resume not found'
        });
      }
    } else {
      // Create new resume
      // If this is set as default, unset other defaults for this user
      if (isDefault) {
        await Resume.updateMany(
          { userId: req.user.userId },
          { isDefault: false }
        );
      }

      resume = new Resume({
        userId: req.user.userId,
        name,
        email,
        phone,
        location,
        jobTitle,
        summary,
        workExperience: workExperience || [],
        education: education || [],
        skills: skills || [],
        themeColor: themeColor || '#3b82f6',
        fontSize: fontSize || 11,
        isDefault: isDefault || false
      });

      await resume.save();
    }

    res.json({
      success: true,
      message: resumeId ? 'Resume updated successfully' : 'Resume created successfully',
      resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save resume',
      error: error.message
    });
  }
});

// Delete a resume
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    res.json({
      success: true,
      message: 'Resume deleted successfully',
      resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete resume',
      error: error.message
    });
  }
});

// Set resume as default
router.patch('/:id/set-default', authMiddleware, async (req, res) => {
  try {
    // First, unset all other defaults for this user
    await Resume.updateMany(
      { userId: req.user.userId },
      { isDefault: false }
    );

    // Set this resume as default
    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { isDefault: true, lastModified: new Date() },
      { new: true }
    );

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    res.json({
      success: true,
      message: 'Resume set as default successfully',
      resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to set resume as default',
      error: error.message
    });
  }
});

// Get default resume for user
router.get('/default/resume', authMiddleware, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      userId: req.user.userId,
      isDefault: true
    }).populate('userId', 'name email');

    if (!resume) {
      // If no default resume, get the most recent one
      const recentResume = await Resume.findOne({
        userId: req.user.userId
      }).sort({ lastModified: -1 }).populate('userId', 'name email');

      if (!recentResume) {
        return res.status(404).json({
          success: false,
          message: 'No resume found'
        });
      }

      return res.json({
        success: true,
        resume: recentResume,
        isDefault: false
      });
    }

    res.json({
      success: true,
      resume,
      isDefault: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch default resume',
      error: error.message
    });
  }
});

// Generate and download PDF (on-demand, no storage)
router.post('/generate-pdf', authMiddleware, async (req, res) => {
  try {
    const {
      resumeId,
      name,
      email,
      phone,
      location,
      jobTitle,
      summary,
      workExperience,
      education,
      skills,
      themeColor,
      fontSize
    } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    let resume;

    if (resumeId) {
      // Update existing resume
      resume = await Resume.findOneAndUpdate(
        { _id: resumeId, userId: req.user.userId },
        {
          name,
          email,
          phone,
          location,
          jobTitle,
          summary,
          workExperience: workExperience || [],
          education: education || [],
          skills: skills || [],
          themeColor: themeColor || '#3b82f6',
          fontSize: fontSize || 11,
          lastModified: new Date()
        },
        { new: true }
      );

      if (!resume) {
        return res.status(404).json({
          success: false,
          message: 'Resume not found'
        });
      }
    } else {
      // Create new resume
      resume = new Resume({
        userId: req.user.userId,
        name,
        email,
        phone,
        location,
        jobTitle,
        summary,
        workExperience: workExperience || [],
        education: education || [],
        skills: skills || [],
        themeColor: themeColor || '#3b82f6',
        fontSize: fontSize || 11
      });

      await resume.save();
    }

    // Generate PDF on-demand
    const pdfResult = await pdfService.generateResumePDF(
      {
        name,
        email,
        phone,
        location,
        jobTitle,
        summary,
        workExperience: workExperience || [],
        education: education || [],
        skills: skills || []
      },
      themeColor || '#3b82f6',
      fontSize || 11
    );

    if (!pdfResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF',
        error: pdfResult.error
      });
    }

    // Send PDF file directly (no storage)
    const pdfPath = pdfResult.filePath;
    
    if (await fs.pathExists(pdfPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.filename}"`);
      
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);
      
      // Clean up the temporary file after sending
      fileStream.on('end', () => {
        fs.remove(pdfPath).catch(console.error);
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'PDF file not found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
});

        // Upload and analyze resume for ATS score using Advanced ATS Analyzer
        router.post('/analyze-ats', authMiddleware, upload.single('resume'), async (req, res) => {
          try {
            if (!req.file) {
              return res.status(400).json({
                success: false,
                message: 'No PDF file uploaded'
              });
            }

            const filePath = req.file.path;
            const analysisMode = req.body.analysisMode || 'general';
            const jobDescription = req.body.jobDescription || '';
            
            console.log('🔍 Starting Advanced ATS Analysis for:', req.file.originalname);
            console.log('📋 Analysis Mode:', analysisMode);
            if (analysisMode === 'job-specific') {
              console.log('🎯 Job Description Length:', jobDescription.length);
            }

            // Use Advanced ATS Analyzer for comprehensive analysis
            const analysisResult = await advancedATSAnalyzer.analyzeResumeAdvanced(filePath, analysisMode, jobDescription);

            if (!analysisResult.success) {
              // Clean up uploaded file
              await advancedATSAnalyzer.cleanupTempFile(filePath);
              return res.status(500).json({
                success: false,
                message: 'Failed to analyze resume with Advanced ATS Analyzer',
                error: analysisResult.error
              });
            }

            // Clean up uploaded file
            await advancedATSAnalyzer.cleanupTempFile(filePath);

            // Return comprehensive analysis results
            res.json({
              success: true,
              message: 'Resume analyzed successfully with Advanced ATS Analyzer',
              analysis: {
                ...analysisResult.analysis,
                fileName: req.file.originalname,
                analysisType: analysisMode === 'job-specific' ? 'Job-Specific ATS Analysis' : 'Advanced ATS Analysis',
                analysisMode: analysisMode,
                timestamp: new Date().toISOString()
              }
            });

          } catch (error) {
            console.error('Error in Advanced ATS Analysis:', error);
            
            // Clean up uploaded file in case of error
            if (req.file) {
              await advancedATSAnalyzer.cleanupTempFile(req.file.path);
            }

            res.status(500).json({
              success: false,
              message: 'Failed to analyze resume with Advanced ATS Analyzer',
              error: error.message
            });
          }
        });

module.exports = router;
