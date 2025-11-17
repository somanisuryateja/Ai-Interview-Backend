const path = require('path');
const fs = require('fs-extra');
const gTTS = require('gtts');
const { randomUUID } = require('crypto');

class TTSService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'uploads', 'audio');
  }

  async ensureOutputDir() {
    await fs.ensureDir(this.outputDir);
  }

  /**
   * Generate an MP3 file from text using Google Translate TTS.
   * @param {string} text - Text to convert to speech.
   * @param {object} [options]
   * @param {string} [options.language=en] - Language code for the voice.
   * @param {boolean} [options.slow=false] - Whether to slow down the speech.
   * @param {string} [options.fileName] - Optional file name (without extension).
   * @returns {Promise<object>} - Details about the generated audio file.
   */
  async generateSpeech(text, options = {}) {
    const {
      language = 'en',
      slow = false,
      fileName
    } = options;

    if (!text || !text.trim()) {
      throw new Error('Text is required to generate speech');
    }

    await this.ensureOutputDir();

    const cleanedText = text.replace(/\s+/g, ' ').trim();
    const maxCharacters = 5000;
    const truncatedText = cleanedText.length > maxCharacters
      ? cleanedText.slice(0, maxCharacters)
      : cleanedText;

    const audioFileName = `${fileName || `${Date.now()}-${randomUUID()}`}.mp3`;
    const audioFilePath = path.join(this.outputDir, audioFileName);
    const publicPath = `/uploads/audio/${audioFileName}`.replace(/\\/g, '/');

    await new Promise((resolve, reject) => {
      const speech = new gTTS(truncatedText, language, slow);
      speech.save(audioFilePath, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    const stats = await fs.stat(audioFilePath);

    return {
      fileName: audioFileName,
      filePath: audioFilePath,
      publicPath,
      size: stats.size,
      textLength: truncatedText.length,
      truncated: truncatedText.length !== cleanedText.length
    };
  }
}

module.exports = TTSService;

