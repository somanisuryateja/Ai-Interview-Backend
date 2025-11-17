const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

class PDFService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'resume-pdfs');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.ensureDir(this.tempDir);
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  async generateResumePDF(resumeData, themeColor = '#3b82f6', fontSize = 11) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Generate HTML content for the resume
      const htmlContent = this.generateResumeHTML(resumeData, themeColor, fontSize);
      
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `resume_${resumeData.name?.replace(/\s+/g, '_') || 'resume'}_${timestamp}.pdf`;
      const filePath = path.join(this.tempDir, filename);
      
      // Generate PDF
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        }
      });

      return {
        success: true,
        filePath: filePath,
        filename: filename
      };
    } catch (error) {
      console.error('Error generating PDF:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  generateResumeHTML(resumeData, themeColor, fontSize) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Resume - ${resumeData.name || 'Resume'}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: Arial, sans-serif;
                font-size: ${fontSize}px;
                line-height: 1.6;
                color: #333;
                background: white;
            }
            
            .resume-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 40px;
                background: white;
            }
            
            .header {
                text-align: center;
                margin-bottom: 40px;
                border-bottom: 3px solid ${themeColor};
                padding-bottom: 20px;
            }
            
            .name {
                font-size: ${fontSize * 3.5}px;
                font-weight: bold;
                color: ${themeColor};
                margin-bottom: 10px;
            }
            
            .job-title {
                font-size: ${fontSize * 1.5}px;
                color: #666;
                margin-bottom: 15px;
            }
            
            .contact-info {
                font-size: ${fontSize}px;
                color: #666;
            }
            
            .contact-info span {
                margin: 0 10px;
            }
            
            .section {
                margin-bottom: 30px;
            }
            
            .section-title {
                font-size: ${fontSize * 1.3}px;
                font-weight: bold;
                color: ${themeColor};
                border-bottom: 2px solid ${themeColor};
                padding-bottom: 5px;
                margin-bottom: 15px;
            }
            
            .work-item, .education-item {
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #eee;
            }
            
            .work-item:last-child, .education-item:last-child {
                border-bottom: none;
            }
            
            .item-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 8px;
            }
            
            .item-title {
                font-size: ${fontSize * 1.1}px;
                font-weight: bold;
                color: #333;
            }
            
            .item-company, .item-institution {
                font-size: ${fontSize}px;
                color: #666;
                font-weight: 500;
            }
            
            .item-duration {
                font-size: ${fontSize * 0.9}px;
                color: #888;
            }
            
            .item-description {
                font-size: ${fontSize}px;
                color: #555;
                margin-top: 5px;
            }
            
            .skills-container {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .skill-tag {
                background-color: ${themeColor};
                color: white;
                padding: 4px 12px;
                border-radius: 15px;
                font-size: ${fontSize * 0.9}px;
                font-weight: 500;
            }
            
            .summary-text {
                font-size: ${fontSize}px;
                color: #555;
                line-height: 1.7;
            }
        </style>
    </head>
    <body>
        <div class="resume-container">
            <!-- Header -->
            <div class="header">
                <div class="name">${resumeData.name || 'Your Name'}</div>
                <div class="job-title">${resumeData.jobTitle || 'Your Job Title'}</div>
                <div class="contact-info">
                    <span>${resumeData.email || 'your.email@example.com'}</span>
                    <span>•</span>
                    <span>${resumeData.phone || 'Your Phone'}</span>
                    <span>•</span>
                    <span>${resumeData.location || 'Your Location'}</span>
                </div>
            </div>

            <!-- Professional Summary -->
            ${resumeData.summary ? `
            <div class="section">
                <div class="section-title">PROFESSIONAL SUMMARY</div>
                <div class="summary-text">${resumeData.summary}</div>
            </div>
            ` : ''}

            <!-- Work Experience -->
            ${resumeData.workExperience && resumeData.workExperience.length > 0 ? `
            <div class="section">
                <div class="section-title">WORK EXPERIENCE</div>
                ${resumeData.workExperience.map(job => `
                <div class="work-item">
                    <div class="item-header">
                        <div>
                            <div class="item-title">${job.title || 'Job Title'}</div>
                            <div class="item-company">${job.company || 'Company Name'}</div>
                        </div>
                        <div class="item-duration">${job.duration || 'Duration'}</div>
                    </div>
                    ${job.description ? `<div class="item-description">${job.description}</div>` : ''}
                </div>
                `).join('')}
            </div>
            ` : ''}

            <!-- Education -->
            ${resumeData.education && resumeData.education.length > 0 ? `
            <div class="section">
                <div class="section-title">EDUCATION</div>
                ${resumeData.education.map(edu => `
                <div class="education-item">
                    <div class="item-header">
                        <div>
                            <div class="item-title">${edu.degree || 'Degree'}</div>
                            <div class="item-institution">${edu.institution || 'Institution'}</div>
                        </div>
                        <div class="item-duration">${edu.duration || 'Duration'}</div>
                    </div>
                    ${edu.description ? `<div class="item-description">${edu.description}</div>` : ''}
                </div>
                `).join('')}
            </div>
            ` : ''}

            <!-- Skills -->
            ${resumeData.skills && resumeData.skills.length > 0 ? `
            <div class="section">
                <div class="section-title">SKILLS</div>
                <div class="skills-container">
                    ${resumeData.skills.map(skill => `
                    <span class="skill-tag">${skill}</span>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    </body>
    </html>
    `;
  }

  async deletePDF(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting PDF:', error);
      return false;
    }
  }
}

module.exports = new PDFService();
