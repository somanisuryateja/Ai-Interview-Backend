const pdfParse = require('pdf-parse');
const fs = require('fs-extra');
const path = require('path');
const AIService = require('./aiService');
const advancedATSAnalyzer = require('./advancedATSAnalyzer');

class PDFTextExtractor {
  constructor() {
    this.tempDir = path.join(__dirname, '..', 'uploads', 'temp');
    
    this.aiService = new AIService();
    this.aiEnabled = this.aiService?.isConfigured?.() || false;

    if (this.aiEnabled) {
      console.log('✅ AI proxy initialized successfully');
    } else {
      console.log('⚠️ AI proxy not configured, using fallback analysis');
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

  async extractTextFromPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      
      return {
        success: true,
        text: data.text,
        pages: data.numpages,
        info: data.info
      };
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeResumeText(text) {
    try {
      // Use the advanced ATS analyzer for comprehensive analysis
      console.log('🔍 Using Advanced ATS Analyzer...');
      
      // For now, we'll use the text-based analysis
      // In a real implementation, you'd pass the file path to get full PDF analysis
      const fallbackAnalysis = await this.fallbackAnalysis(text);
      
      // Enhance with AI if available
      if (this.aiEnabled) {
        const aiAnalysis = await this.performAIAnalysis(text);
        if (aiAnalysis) {
          return {
            success: true,
            analysis: {
              ...fallbackAnalysis,
              ...aiAnalysis,
              aiEnhanced: true
            }
          };
        }
      }
      
      return {
        success: true,
        analysis: fallbackAnalysis
      };
    } catch (error) {
      console.error('Error in advanced resume analysis:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performAIAnalysis(text) {
    if (!this.aiEnabled) return null;
    
    try {
      const prompt = `
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

      const result = await this.aiService.generateContent(prompt, {
        temperature: 0.2,
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
        return null;
      }
    } catch (error) {
      console.error('Error in AI analysis:', error);
      return null;
    }
  }

  // Fallback analysis method when AI analysis fails
  async fallbackAnalysis(text) {
    const analysis = {
      sections: this.identifySections(text),
      keywords: this.extractKeywords(text),
      contactInfo: this.extractContactInfo(text),
      experience: this.extractExperience(text),
      education: this.extractEducation(text),
      skills: this.extractSkills(text),
      atsScore: 0,
      feedback: [],
      grade: 'D',
      recommendations: [],
      strengths: [],
      weaknesses: []
    };

    // Calculate ATS Score
    analysis.atsScore = this.calculateATSScore(analysis);
    analysis.feedback = this.generateFeedback(analysis);
    
    // Determine grade
    if (analysis.atsScore >= 80) analysis.grade = 'A';
    else if (analysis.atsScore >= 60) analysis.grade = 'B';
    else if (analysis.atsScore >= 40) analysis.grade = 'C';
    else analysis.grade = 'D';

    return analysis;
  }

  calculateATSScore(analysis) {
    let score = 0;
    
    // ATS SCORING CRITERIA (Industry Standard)
    // Format compatibility (20 points): Standard fonts, clear sections, no graphics/tables
    if (analysis.sections.personalInfo) score += 5; // Basic format check
    if (analysis.sections.summary) score += 5; // Clear sections
    if (analysis.sections.experience) score += 5; // Structured content
    if (analysis.sections.education) score += 5; // Standard sections
    
    // Contact information (15 points): Name, email, phone, location
    if (analysis.contactInfo.email) score += 5;
    if (analysis.contactInfo.phone) score += 5;
    if (analysis.contactInfo.linkedin) score += 3;
    if (analysis.contactInfo.github) score += 2;
    
    // Professional summary (10 points): Clear objective/summary section
    if (analysis.sections.summary) score += 10;
    
    // Work experience (25 points): Detailed job history with dates, companies, descriptions
    if (analysis.sections.experience) score += 15;
    score += Math.min(analysis.experience.length * 2, 10); // Bonus for multiple experiences
    
    // Education (10 points): Degrees, institutions, graduation dates
    if (analysis.sections.education) score += 10;
    
    // Skills section (10 points): Relevant technical and soft skills
    if (analysis.sections.skills) score += 5;
    score += Math.min(analysis.skills.length * 0.5, 5); // Bonus for skill count
    
    // Keywords optimization (10 points): Industry-relevant keywords and action verbs
    score += Math.min(analysis.keywords.technical.length * 1.5, 5);
    score += Math.min(analysis.keywords.actionWords.length * 1, 5);
    
    return Math.min(Math.round(score), 100);
  }

  generateFeedback(analysis) {
    const feedback = [];
    
    // ATS-Focused Feedback
    if (!analysis.sections.summary) {
      feedback.push("ATS requires a professional summary section for better parsing");
    }
    
    if (!analysis.sections.experience) {
      feedback.push("Work experience section is critical for ATS compatibility");
    }
    
    if (!analysis.sections.education) {
      feedback.push("Education section helps ATS categorize your qualifications");
    }
    
    if (!analysis.sections.skills) {
      feedback.push("Dedicated skills section improves ATS keyword matching");
    }
    
    if (!analysis.contactInfo.email) {
      feedback.push("Email address is required for ATS contact parsing");
    }
    
    if (!analysis.contactInfo.phone) {
      feedback.push("Phone number helps ATS complete contact information");
    }
    
    if (analysis.keywords.technical.length < 5) {
      feedback.push("Include more industry-specific technical keywords for ATS matching");
    }
    
    if (analysis.keywords.actionWords.length < 3) {
      feedback.push("Add more action verbs (led, managed, developed) for ATS optimization");
    }
    
    if (analysis.skills.length < 5) {
      feedback.push("List specific skills and technologies for better ATS recognition");
    }
    
    if (!analysis.contactInfo.linkedin) {
      feedback.push("LinkedIn profile URL enhances ATS professional networking data");
    }
    
    return feedback;
  }

  identifySections(text) {
    const sections = {};
    const lowerText = text.toLowerCase();
    
    // Common section headers
    const sectionPatterns = {
      summary: ['summary', 'objective', 'profile', 'about'],
      experience: ['experience', 'work history', 'employment', 'career'],
      education: ['education', 'academic', 'qualifications', 'degrees'],
      skills: ['skills', 'competencies', 'technologies', 'expertise'],
      projects: ['projects', 'portfolio', 'achievements'],
      certifications: ['certifications', 'certificates', 'licenses']
    };

    Object.keys(sectionPatterns).forEach(section => {
      const patterns = sectionPatterns[section];
      const found = patterns.some(pattern => lowerText.includes(pattern));
      sections[section] = found;
    });

    return sections;
  }

  extractKeywords(text) {
    const lowerText = text.toLowerCase();
    
    // Common resume keywords
    const keywordCategories = {
      technical: ['javascript', 'python', 'react', 'node.js', 'sql', 'html', 'css', 'git', 'docker', 'aws'],
      soft: ['leadership', 'communication', 'teamwork', 'problem solving', 'management', 'collaboration'],
      action: ['developed', 'created', 'managed', 'led', 'implemented', 'designed', 'built', 'achieved'],
      education: ['bachelor', 'master', 'degree', 'university', 'college', 'phd', 'diploma'],
      experience: ['years', 'experience', 'senior', 'junior', 'intern', 'internship', 'freelance']
    };

    const foundKeywords = {};
    Object.keys(keywordCategories).forEach(category => {
      foundKeywords[category] = keywordCategories[category].filter(keyword => 
        lowerText.includes(keyword)
      );
    });

    return foundKeywords;
  }

  extractContactInfo(text) {
    const contactInfo = {};
    
    // Email pattern
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) contactInfo.email = emailMatch[0];
    
    // Phone pattern
    const phoneMatch = text.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
    if (phoneMatch) contactInfo.phone = phoneMatch[0];
    
    // LinkedIn pattern
    const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9-]+/i);
    if (linkedinMatch) contactInfo.linkedin = linkedinMatch[0];
    
    // GitHub pattern
    const githubMatch = text.match(/github\.com\/[a-zA-Z0-9-]+/i);
    if (githubMatch) contactInfo.github = githubMatch[0];

    return contactInfo;
  }

  extractExperience(text) {
    const experience = [];
    const lines = text.split('\n');
    
    // Look for experience patterns
    let inExperienceSection = false;
    let currentJob = null;
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // Check if we're entering experience section
      if (trimmedLine.toLowerCase().includes('experience') || 
          trimmedLine.toLowerCase().includes('work history')) {
        inExperienceSection = true;
        return;
      }
      
      // Check if we're leaving experience section
      if (inExperienceSection && (
          trimmedLine.toLowerCase().includes('education') ||
          trimmedLine.toLowerCase().includes('skills'))) {
        inExperienceSection = false;
        return;
      }
      
      // Extract job information
      if (inExperienceSection) {
        // Look for job title patterns
        if (trimmedLine.match(/^[A-Z][a-zA-Z\s]+(?:Developer|Engineer|Manager|Analyst|Designer|Consultant)/)) {
          if (currentJob) experience.push(currentJob);
          currentJob = {
            title: trimmedLine,
            company: '',
            duration: '',
            description: ''
          };
        }
        // Look for company patterns
        else if (currentJob && !currentJob.company && trimmedLine.match(/^[A-Z][a-zA-Z\s&.,]+(?:Inc|LLC|Corp|Company|Ltd)/)) {
          currentJob.company = trimmedLine;
        }
        // Look for duration patterns
        else if (currentJob && trimmedLine.match(/\d{4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/)) {
          currentJob.duration = trimmedLine;
        }
        // Description lines
        else if (currentJob && trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
          currentJob.description += trimmedLine + ' ';
        }
      }
    });
    
    if (currentJob) experience.push(currentJob);
    return experience;
  }

  extractEducation(text) {
    const education = [];
    const lines = text.split('\n');
    
    let inEducationSection = false;
    let currentEdu = null;
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // Check if we're entering education section
      if (trimmedLine.toLowerCase().includes('education') || 
          trimmedLine.toLowerCase().includes('academic')) {
        inEducationSection = true;
        return;
      }
      
      // Check if we're leaving education section
      if (inEducationSection && (
          trimmedLine.toLowerCase().includes('skills') ||
          trimmedLine.toLowerCase().includes('experience'))) {
        inEducationSection = false;
        return;
      }
      
      // Extract education information
      if (inEducationSection) {
        // Look for degree patterns
        if (trimmedLine.match(/\b(?:Bachelor|Master|PhD|Associate|Diploma|Certificate)\b/i)) {
          if (currentEdu) education.push(currentEdu);
          currentEdu = {
            degree: trimmedLine,
            institution: '',
            duration: '',
            description: ''
          };
        }
        // Look for institution patterns
        else if (currentEdu && !currentEdu.institution && trimmedLine.match(/University|College|Institute|School/i)) {
          currentEdu.institution = trimmedLine;
        }
        // Look for duration patterns
        else if (currentEdu && trimmedLine.match(/\d{4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/)) {
          currentEdu.duration = trimmedLine;
        }
      }
    });
    
    if (currentEdu) education.push(currentEdu);
    return education;
  }

  extractSkills(text) {
    const skills = [];
    const lowerText = text.toLowerCase();
    
    // Common skills patterns
    const skillPatterns = [
      // Technical skills
      'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node.js', 'express',
      'mongodb', 'mysql', 'postgresql', 'redis', 'docker', 'kubernetes', 'aws', 'azure',
      'git', 'github', 'gitlab', 'jenkins', 'ci/cd', 'agile', 'scrum',
      // Design skills
      'photoshop', 'illustrator', 'figma', 'sketch', 'adobe', 'ui/ux', 'wireframing',
      // Soft skills
      'leadership', 'communication', 'teamwork', 'problem solving', 'project management',
      'analytical', 'creative', 'detail-oriented', 'time management'
    ];
    
    skillPatterns.forEach(skill => {
      if (lowerText.includes(skill)) {
        skills.push(skill);
      }
    });
    
    return [...new Set(skills)]; // Remove duplicates
  }

  calculateATSScore(analysis) {
    let score = 0;
    const feedback = [];
    
    // Contact Information (20 points)
    const contactCount = Object.keys(analysis.contactInfo).length;
    if (contactCount >= 2) {
      score += 20;
      feedback.push('✅ Contact information present');
    } else {
      feedback.push('❌ Missing contact information');
    }
    
    // Sections (30 points)
    const sectionCount = Object.values(analysis.sections).filter(Boolean).length;
    if (sectionCount >= 4) {
      score += 30;
      feedback.push('✅ Good section structure');
    } else {
      feedback.push('❌ Missing important sections');
    }
    
    // Experience (25 points)
    if (analysis.experience.length > 0) {
      score += 25;
      feedback.push('✅ Work experience included');
    } else {
      feedback.push('❌ No work experience found');
    }
    
    // Education (15 points)
    if (analysis.education.length > 0) {
      score += 15;
      feedback.push('✅ Education section present');
    } else {
      feedback.push('❌ Education section missing');
    }
    
    // Skills (10 points)
    if (analysis.skills.length >= 5) {
      score += 10;
      feedback.push('✅ Good skills coverage');
    } else {
      feedback.push('❌ Limited skills listed');
    }
    
    analysis.feedback = feedback;
    return Math.min(score, 100);
  }

  async cleanupTempFile(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error cleaning up temp file:', error);
      return false;
    }
  }
}

module.exports = new PDFTextExtractor();
