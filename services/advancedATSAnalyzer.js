const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const AIService = require('../services/aiService');

class AdvancedATSAnalyzer {
  constructor() {
    this.tempDir = path.join(__dirname, '..', 'uploads', 'temp');
    
    this.aiService = new AIService();
    this.aiEnabled = this.aiService?.isConfigured?.() || false;
    this.analysisCache = new Map();

    if (this.aiEnabled) {
      console.log('✅ Advanced ATS Analyzer connected to AI proxy');
    } else {
      console.log('⚠️ AI proxy not configured, using advanced fallback analysis');
    }
    
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.ensureDir(this.tempDir);
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  async analyzeResumeAdvanced(filePath, analysisMode = 'general', jobDescription = '') {
    try {
      console.log('🔍 Starting advanced ATS analysis...');
      console.log('📋 Analysis Mode:', analysisMode);
      
      // Step 1: Extract detailed PDF information
      const pdfInfo = await this.extractDetailedPDFInfo(filePath);
      const cacheKey = this.buildCacheKey(pdfInfo.text, analysisMode, jobDescription);

      if (this.analysisCache.has(cacheKey)) {
        console.log('♻️ Returning cached ATS analysis result');
        const cached = this.analysisCache.get(cacheKey);
        return {
          success: true,
          analysis: JSON.parse(JSON.stringify(cached))
        };
      }
      
      // Step 2: Analyze layout structure
      const layoutAnalysis = this.analyzeLayoutStructure(pdfInfo);
      
      // Step 3: Analyze fonts and formatting
      const fontAnalysis = this.analyzeFontsAndFormatting(pdfInfo);
      
      // Step 4: Analyze content quality
      const contentAnalysis = this.analyzeContentQuality(pdfInfo.text);
      
      // Step 5: Job-specific analysis if requested
      let jobMatch = null;
      if (analysisMode === 'job-specific' && jobDescription.trim()) {
        jobMatch = await this.analyzeJobMatch(pdfInfo.text, jobDescription);
        console.log('🎯 Job match analysis completed');
      }
      
      // Step 6: Calculate comprehensive ATS score
      const atsScore = this.calculateAdvancedATSScore(layoutAnalysis, fontAnalysis, contentAnalysis, jobMatch);
      
      // Step 7: Generate detailed feedback
      const feedback = this.generateAdvancedFeedback(layoutAnalysis, fontAnalysis, contentAnalysis, atsScore, jobMatch);
      
      // Step 8: Use AI for comprehensive analysis (REQUIRED)
      let aiAnalysis = null;
      if (this.aiEnabled) {
        aiAnalysis = await this.performAIAnalysis(pdfInfo.text, layoutAnalysis, fontAnalysis, contentAnalysis, jobDescription, analysisMode);
      } else {
        throw new Error('AI service is required for analysis. Please configure the AI proxy.');
      }

      const analysisPayload = {
        success: true,
        analysis: {
          atsScore: aiAnalysis.atsScore,
          grade: aiAnalysis.grade,
          feedback: aiAnalysis.feedback,
          strengths: aiAnalysis.strengths,
          weaknesses: aiAnalysis.weaknesses,
          recommendations: aiAnalysis.recommendations,
          sections: aiAnalysis.sections,
          contactInfo: aiAnalysis.contactInfo,
          keywords: aiAnalysis.keywords,
          experience: aiAnalysis.experience,
          education: aiAnalysis.education,
          skills: aiAnalysis.skills,
          jobMatch: aiAnalysis.jobMatch || jobMatch,
          analysisMode: analysisMode,
          layout: layoutAnalysis,
          fonts: fontAnalysis,
          content: contentAnalysis,
          scoring: atsScore
        }
      };
      
      this.analysisCache.set(cacheKey, JSON.parse(JSON.stringify(analysisPayload.analysis)));
      return analysisPayload;
      
    } catch (error) {
      console.error('Error in advanced ATS analysis:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  buildCacheKey(text, analysisMode, jobDescription) {
    const normalizedText = (text || '').replace(/\s+/g, ' ').trim();
    const normalizedJD = (jobDescription || '').replace(/\s+/g, ' ').trim();
    const hash = crypto.createHash('sha256').update(normalizedText).update('|').update(analysisMode).update('|').update(normalizedJD).digest('hex');
    return hash;
  }

  async extractDetailedPDFInfo(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      // Load PDF with pdf-lib for detailed analysis
      const pdfDoc = await PDFDocument.load(dataBuffer);
      const pages = pdfDoc.getPages();
      
      return {
        text: pdfData.text,
        pages: pdfData.numpages,
        info: pdfData.info,
        fonts: this.extractFonts(pages),
        layout: this.extractLayoutInfo(pages),
        metadata: pdfData.metadata
      };
    } catch (error) {
      console.error('Error extracting PDF info:', error);
      throw error;
    }
  }

  extractFonts(pages) {
    const fonts = new Set();
    const fontSizes = [];
    
    pages.forEach(page => {
      // Extract font information from page
      const pageFonts = this.getPageFonts(page);
      pageFonts.forEach(font => fonts.add(font));
    });
    
    return {
      used: Array.from(fonts),
      isStandard: this.checkStandardFonts(Array.from(fonts)),
      consistency: this.checkFontConsistency(fonts)
    };
  }

  getPageFonts(page) {
    // This is a simplified version - in reality, you'd need more complex PDF parsing
    const standardFonts = ['Arial', 'Times New Roman', 'Calibri', 'Helvetica', 'Verdana'];
    return standardFonts; // Placeholder - would need actual font extraction
  }

  checkStandardFonts(fonts) {
    const standardFonts = ['Arial', 'Times New Roman', 'Calibri', 'Helvetica', 'Verdana'];
    return fonts.some(font => standardFonts.includes(font));
  }

  checkFontConsistency(fonts) {
    return fonts.size <= 3; // Good if using 3 or fewer different fonts
  }

  extractLayoutInfo(pages) {
    return {
      hasTables: this.detectTables(pages),
      hasImages: this.detectImages(pages),
      hasComplexLayout: this.detectComplexLayout(pages),
      pageCount: pages.length
    };
  }

  detectTables(pages) {
    // Simplified table detection - would need more sophisticated analysis
    return false;
  }

  detectImages(pages) {
    // Simplified image detection
    return false;
  }

  detectComplexLayout(pages) {
    // Check for complex layouts that might confuse ATS
    return false;
  }

  analyzeLayoutStructure(pdfInfo) {
    const layoutScore = {
      hasProperHeaders: false,
      consistentFormatting: false,
      noTables: false,
      noGraphics: false,
      properSpacing: false,
      standardFormat: false,
      score: 0
    };

    const text = pdfInfo.text.toLowerCase();
    
    // Check for proper section headers
    const sectionHeaders = ['summary', 'experience', 'education', 'skills', 'contact', 'objective'];
    const foundHeaders = sectionHeaders.filter(header => text.includes(header));
    layoutScore.hasProperHeaders = foundHeaders.length >= 4;
    
    // Check for consistent formatting (simplified)
    layoutScore.consistentFormatting = this.checkConsistentFormatting(text);
    
    // Check for ATS-unfriendly elements
    layoutScore.noTables = !pdfInfo.layout.hasTables;
    layoutScore.noGraphics = !pdfInfo.layout.hasImages;
    layoutScore.standardFormat = !pdfInfo.layout.hasComplexLayout;
    
    // Calculate layout score
    if (layoutScore.hasProperHeaders) layoutScore.score += 20;
    if (layoutScore.consistentFormatting) layoutScore.score += 15;
    if (layoutScore.noTables) layoutScore.score += 10;
    if (layoutScore.noGraphics) layoutScore.score += 10;
    if (layoutScore.standardFormat) layoutScore.score += 10;
    if (layoutScore.properSpacing) layoutScore.score += 10;

    return layoutScore;
  }

  checkConsistentFormatting(text) {
    // Check for consistent bullet points, spacing, etc.
    const bulletPoints = (text.match(/[•·▪▫]/g) || []).length;
    const dashes = (text.match(/^-/gm) || []).length;
    return Math.abs(bulletPoints - dashes) < 3; // Consistent formatting
  }

  analyzeFontsAndFormatting(pdfInfo) {
    const fontScore = {
      usesStandardFonts: pdfInfo.fonts.isStandard,
      consistentFonts: pdfInfo.fonts.consistency,
      appropriateSizing: true, // Would need actual font size analysis
      noFancyFormatting: true,
      score: 0
    };

    // Calculate font score
    if (fontScore.usesStandardFonts) fontScore.score += 20;
    if (fontScore.consistentFonts) fontScore.score += 15;
    if (fontScore.appropriateSizing) fontScore.score += 10;
    if (fontScore.noFancyFormatting) fontScore.score += 10;

    return fontScore;
  }

  analyzeContentQuality(text) {
    const contentScore = {
      hasProfessionalSummary: false,
      hasDetailedExperience: false,
      hasRelevantSkills: false,
      hasEducationInfo: false,
      hasContactInfo: false,
      keywordDensity: 0,
      score: 0
    };

    const lowerText = text.toLowerCase();
    
    // Check for professional summary
    contentScore.hasProfessionalSummary = this.hasProfessionalSummary(lowerText);
    
    // Check for detailed experience
    contentScore.hasDetailedExperience = this.hasDetailedExperience(lowerText);
    
    // Check for relevant skills
    contentScore.hasRelevantSkills = this.hasRelevantSkills(lowerText);
    
    // Check for education info
    contentScore.hasEducationInfo = this.hasEducationInfo(lowerText);
    
    // Check for contact info
    contentScore.hasContactInfo = this.hasContactInfo(lowerText);
    
    // Calculate keyword density
    contentScore.keywordDensity = this.calculateKeywordDensity(lowerText);
    
    // Calculate content score
    if (contentScore.hasProfessionalSummary) contentScore.score += 15;
    if (contentScore.hasDetailedExperience) contentScore.score += 20;
    if (contentScore.hasRelevantSkills) contentScore.score += 15;
    if (contentScore.hasEducationInfo) contentScore.score += 10;
    if (contentScore.hasContactInfo) contentScore.score += 15;
    contentScore.score += Math.min(contentScore.keywordDensity * 2, 25);

    return contentScore;
  }

  hasProfessionalSummary(text) {
    const summaryKeywords = ['summary', 'profile', 'objective', 'about'];
    return summaryKeywords.some(keyword => text.includes(keyword)) && 
           text.split('\n').some(line => line.length > 50);
  }

  hasDetailedExperience(text) {
    const experienceKeywords = ['experience', 'work history', 'employment'];
    return experienceKeywords.some(keyword => text.includes(keyword)) &&
           (text.match(/\d{4}/g) || []).length >= 2; // At least 2 years mentioned
  }

  hasRelevantSkills(text) {
    const skillsKeywords = ['skills', 'competencies', 'technologies'];
    return skillsKeywords.some(keyword => text.includes(keyword)) &&
           (text.match(/[a-zA-Z]+/g) || []).length > 10; // Multiple skills listed
  }

  hasEducationInfo(text) {
    const educationKeywords = ['education', 'degree', 'university', 'college'];
    return educationKeywords.some(keyword => text.includes(keyword));
  }

  hasContactInfo(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/;
    return emailRegex.test(text) && phoneRegex.test(text);
  }

  calculateKeywordDensity(text) {
    const technicalKeywords = [
      'javascript', 'python', 'java', 'react', 'node.js', 'mongodb', 'sql',
      'aws', 'docker', 'kubernetes', 'git', 'agile', 'scrum', 'leadership',
      'management', 'analysis', 'development', 'design', 'implementation'
    ];
    
    const foundKeywords = technicalKeywords.filter(keyword => text.includes(keyword));
    return foundKeywords.length;
  }

  calculateAdvancedATSScore(layout, fonts, content) {
    const totalScore = layout.score + fonts.score + content.score;
    const maxPossible = 100;
    
    return {
      total: Math.min(totalScore, maxPossible),
      layout: layout.score,
      fonts: fonts.score,
      content: content.score,
      breakdown: {
        layoutPercentage: (layout.score / 75) * 100,
        fontPercentage: (fonts.score / 55) * 100,
        contentPercentage: (content.score / 100) * 100
      }
    };
  }

  getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C+';
    if (score >= 40) return 'C';
    return 'D';
  }

  generateAdvancedFeedback(layout, fonts, content, scoring) {
    const feedback = [];
    
    // Layout feedback
    if (!layout.hasProperHeaders) {
      feedback.push('❌ Missing proper section headers (Summary, Experience, Education, Skills)');
    }
    if (!layout.consistentFormatting) {
      feedback.push('❌ Inconsistent formatting throughout the resume');
    }
    if (layout.hasTables) {
      feedback.push('❌ Contains tables which may not be ATS-friendly');
    }
    if (layout.hasGraphics) {
      feedback.push('❌ Contains graphics/images that ATS cannot read');
    }
    
    // Font feedback
    if (!fonts.usesStandardFonts) {
      feedback.push('❌ Using non-standard fonts - use Arial, Times New Roman, or Calibri');
    }
    if (!fonts.consistentFonts) {
      feedback.push('❌ Too many different fonts used - maintain consistency');
    }
    
    // Content feedback
    if (!content.hasProfessionalSummary) {
      feedback.push('❌ Missing or weak professional summary');
    }
    if (!content.hasDetailedExperience) {
      feedback.push('❌ Work experience section needs more detail');
    }
    if (!content.hasRelevantSkills) {
      feedback.push('❌ Skills section is missing or insufficient');
    }
    if (!content.hasContactInfo) {
      feedback.push('❌ Missing complete contact information');
    }
    if (content.keywordDensity < 5) {
      feedback.push('❌ Low keyword density - add more industry-relevant terms');
    }
    
    // Positive feedback
    if (layout.score >= 60) {
      feedback.push('✅ Good resume structure and layout');
    }
    if (fonts.score >= 40) {
      feedback.push('✅ Appropriate font choices and formatting');
    }
    if (content.score >= 70) {
      feedback.push('✅ Strong content and keyword optimization');
    }
    
    return feedback;
  }

  generateRecommendations(scoring, layout, fonts, content) {
    const recommendations = [];
    
    if (scoring.layout < 50) {
      recommendations.push('Restructure resume with clear section headers and consistent formatting');
    }
    if (scoring.fonts < 30) {
      recommendations.push('Switch to standard fonts (Arial, Times New Roman, Calibri)');
    }
    if (scoring.content < 60) {
      recommendations.push('Enhance content with more detailed experience and relevant keywords');
    }
    if (content.keywordDensity < 8) {
      recommendations.push('Add more industry-specific keywords and technical terms');
    }
    
    return recommendations;
  }

  async performAIAnalysis(text, layout, fonts, content, jobDescription, analysisMode) {
    if (!this.aiEnabled) return null;
    
    try {
      let prompt = '';
      
      if (analysisMode === 'job-specific' && jobDescription.trim()) {
        // Job-specific analysis with AI service
        prompt = `
          You are an expert ATS (Applicant Tracking System) analyst specializing in job-resume matching. Analyze this resume against the specific job description and provide comprehensive ATS compatibility assessment.

          JOB DESCRIPTION:
          ${jobDescription.substring(0, 2000)}

          RESUME TEXT:
          ${text.substring(0, 3000)}

          ANALYSIS REQUIREMENTS:
          1. Compare resume content against job requirements
          2. Calculate keyword match percentage
          3. Assess skills alignment
          4. Evaluate experience relevance
          5. Check ATS format compatibility
          6. Provide specific improvement recommendations

          Return your analysis in this EXACT JSON format:
          {
            "atsScore": <number between 0-100>,
            "grade": "<A+/A/B+/B/C+/C/D>",
            "feedback": ["<specific ATS feedback points>"],
            "jobMatch": {
              "keywordMatch": <percentage 0-100>,
              "skillsMatch": <percentage 0-100>,
              "experienceMatch": <percentage 0-100>,
              "overallMatch": <percentage 0-100>,
              "missingKeywords": ["<keywords from job not found in resume>"],
              "matchedKeywords": ["<keywords found in both>"]
            },
            "sections": {
              "personalInfo": <boolean>,
              "summary": <boolean>,
              "workExperience": <boolean>,
              "education": <boolean>,
              "skills": <boolean>
            },
            "contactInfo": {
              "email": "<email if found>",
              "phone": "<phone if found>",
              "linkedin": "<linkedin if found>",
              "github": "<github if found>"
            },
            "keywords": {
              "technical": ["<technical keywords found>"],
              "softSkills": ["<soft skills found>"],
              "actionWords": ["<action verbs found>"]
            },
            "experience": [
              {
                "title": "<job title>",
                "company": "<company name>",
                "duration": "<duration>",
                "description": "<brief description>"
              }
            ],
            "education": [
              {
                "degree": "<degree>",
                "institution": "<institution>",
                "duration": "<duration>"
              }
            ],
            "skills": ["<list of skills found>"],
            "recommendations": ["<specific improvement recommendations for this job>"],
            "strengths": ["<job-relevant strengths>"],
            "weaknesses": ["<job-specific weaknesses>"]
          }

          Focus on job-resume compatibility: keyword matching, skills alignment, experience relevance, and ATS optimization for this specific position.
        `;
      } else {
        // General ATS analysis with AI service
        prompt = `
          You are an expert ATS (Applicant Tracking System) analyst. Analyze this resume text and provide a comprehensive ATS compatibility assessment.

          ATS SCORING CRITERIA:
          - Format compatibility (25 points): Standard fonts, clear sections, no graphics/tables
          - Content structure (25 points): Proper headers, logical flow, professional presentation
          - Keyword optimization (20 points): Industry-relevant terms and action verbs
          - Contact completeness (15 points): All required contact information
          - Professional summary (15 points): Clear, compelling summary section

          Return your analysis in this EXACT JSON format:
          {
            "atsScore": <number between 0-100>,
            "grade": "<A+/A/B+/B/C+/C/D>",
            "feedback": ["<specific ATS feedback points>"],
            "sections": {
              "personalInfo": <boolean>,
              "summary": <boolean>,
              "workExperience": <boolean>,
              "education": <boolean>,
              "skills": <boolean>
            },
            "contactInfo": {
              "email": "<email if found>",
              "phone": "<phone if found>",
              "linkedin": "<linkedin if found>",
              "github": "<github if found>"
            },
            "keywords": {
              "technical": ["<technical keywords found>"],
              "softSkills": ["<soft skills found>"],
              "actionWords": ["<action verbs found>"]
            },
            "experience": [
              {
                "title": "<job title>",
                "company": "<company name>",
                "duration": "<duration>",
                "description": "<brief description>"
              }
            ],
            "education": [
              {
                "degree": "<degree>",
                "institution": "<institution>",
                "duration": "<duration>"
              }
            ],
            "skills": ["<list of skills found>"],
            "recommendations": ["<specific ATS improvement recommendations>"],
            "strengths": ["<ATS-compatible strengths>"],
            "weaknesses": ["<ATS compatibility issues>"]
          }

          Resume Text:
          ${text.substring(0, 3000)}

          Focus on ATS compatibility factors: format, keywords, section structure, contact info completeness, and industry relevance. Provide actionable feedback for ATS optimization.
        `;
      }

      const result = await this.aiService.generateContent(prompt, {
        temperature: 0,
        topP: 0.05,
        presencePenalty: 0,
        frequencyPenalty: 0,
        maxOutputTokens: 2048
      });

      if (!result.success) {
        throw new Error(result.error || 'AI proxy returned an error');
      }

      const analysisText = result.text || '';

      // Parse the JSON response from the AI service
      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.log('Raw AI response:', analysisText);
        throw new Error('Failed to parse AI response');
      }
    } catch (error) {
      console.error('Error in AI analysis:', error);
      throw new Error('AI analysis failed: ' + error.message);
    }
  }

  async analyzeJobMatch(resumeText, jobDescription) {
    try {
      console.log('🎯 Analyzing job match...');
      
      // Extract keywords from job description
      const jobKeywords = this.extractKeywords(jobDescription);
      const resumeKeywords = this.extractKeywords(resumeText);
      
      // Calculate keyword match percentage
      const matchedKeywords = jobKeywords.filter(keyword => 
        resumeKeywords.some(resumeKeyword => 
          resumeKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(resumeKeyword.toLowerCase())
        )
      );
      
      const keywordMatch = Math.round((matchedKeywords.length / jobKeywords.length) * 100);
      
      // Extract skills from job description
      const jobSkills = this.extractSkills(jobDescription);
      const resumeSkills = this.extractSkills(resumeText);
      
      const matchedSkills = jobSkills.filter(skill => 
        resumeSkills.some(resumeSkill => 
          resumeSkill.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(resumeSkill.toLowerCase())
        )
      );
      
      const skillsMatch = Math.round((matchedSkills.length / jobSkills.length) * 100);
      
      // Extract experience requirements
      const experienceMatch = this.calculateExperienceMatch(resumeText, jobDescription);
      
      // Calculate overall match
      const overallMatch = Math.round((keywordMatch + skillsMatch + experienceMatch) / 3);
      
      // Find missing keywords
      const missingKeywords = jobKeywords.filter(keyword => 
        !matchedKeywords.includes(keyword)
      ).slice(0, 10); // Limit to 10 missing keywords
      
      return {
        keywordMatch: keywordMatch || 0,
        skillsMatch: skillsMatch || 0,
        experienceMatch: experienceMatch || 0,
        overallMatch: overallMatch || 0,
        matchedKeywords: matchedKeywords,
        missingKeywords: missingKeywords,
        jobKeywords: jobKeywords.slice(0, 20), // Show first 20 job keywords
        resumeKeywords: resumeKeywords.slice(0, 20) // Show first 20 resume keywords
      };
      
    } catch (error) {
      console.error('Error in job match analysis:', error);
      return {
        keywordMatch: 0,
        skillsMatch: 0,
        experienceMatch: 0,
        overallMatch: 0,
        matchedKeywords: [],
        missingKeywords: [],
        jobKeywords: [],
        resumeKeywords: []
      };
    }
  }

  extractKeywords(text) {
    // Common technical keywords
    const technicalKeywords = [
      'javascript', 'python', 'java', 'react', 'node.js', 'mongodb', 'sql',
      'aws', 'docker', 'kubernetes', 'git', 'agile', 'scrum', 'leadership',
      'management', 'analysis', 'development', 'design', 'implementation',
      'frontend', 'backend', 'fullstack', 'api', 'rest', 'graphql',
      'machine learning', 'ai', 'data science', 'analytics', 'cloud',
      'devops', 'ci/cd', 'testing', 'automation', 'security'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => 
      word.length > 3 && 
      technicalKeywords.some(keyword => 
        word.includes(keyword) || keyword.includes(word)
      )
    );
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  extractSkills(text) {
    const skillPatterns = [
      /(?:skills?|technologies?|tools?|frameworks?|languages?)[:\s]+([^.\n]+)/gi,
      /(?:proficient in|experienced with|expert in)[:\s]+([^.\n]+)/gi,
      /(?:knowledge of|familiar with)[:\s]+([^.\n]+)/gi
    ];
    
    const skills = [];
    skillPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const skillText = match.replace(/(?:skills?|technologies?|tools?|frameworks?|languages?|proficient in|experienced with|expert in|knowledge of|familiar with)[:\s]+/gi, '');
          const skillList = skillText.split(/[,;|&]/).map(skill => skill.trim()).filter(skill => skill.length > 2);
          skills.push(...skillList);
        });
      }
    });
    
    return [...new Set(skills)]; // Remove duplicates
  }

  calculateExperienceMatch(resumeText, jobDescription) {
    // Extract years of experience from job description
    const jobExpMatch = jobDescription.match(/(\d+)[\s-]*(\+)?[\s]*years?[\s]*of[\s]*experience/gi);
    const requiredYears = jobExpMatch ? parseInt(jobExpMatch[0]) : 0;
    
    // Extract years of experience from resume
    const resumeExpMatch = resumeText.match(/(\d+)[\s-]*(\+)?[\s]*years?[\s]*of[\s]*experience/gi);
    const actualYears = resumeExpMatch ? parseInt(resumeExpMatch[0]) : 0;
    
    if (requiredYears === 0) return 100; // No experience requirement
    if (actualYears >= requiredYears) return 100; // Meets or exceeds requirement
    
    return Math.round((actualYears / requiredYears) * 100);
  }

  async cleanupTempFile(filePath) {
    try {
      await fs.remove(filePath);
      console.log(`Cleaned up temporary file: ${filePath}`);
    } catch (error) {
      console.error(`Error cleaning up temporary file ${filePath}:`, error);
    }
  }
}

module.exports = new AdvancedATSAnalyzer();
