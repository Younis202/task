const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

class FileManager {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.maxFileAge = 3600000; // 1 hour in milliseconds
    this.cleanupInterval = 1800000; // 30 minutes in milliseconds
    
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Start cleanup interval
      setInterval(() => {
        this.cleanupOldFiles();
      }, this.cleanupInterval);
      
      logger.info('File manager initialized', { tempDir: this.tempDir });
    } catch (error) {
      logger.error('Failed to initialize file manager', { error: error.message });
    }
  }

  async createTempDirectory() {
    const dirId = uuidv4();
    const dirPath = path.join(this.tempDir, dirId);
    
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return dirPath;
    } catch (error) {
      logger.error('Failed to create temp directory', { error: error.message, dirPath });
      throw error;
    }
  }

  async saveScreenshot(buffer, tempDir, filename) {
    const filePath = path.join(tempDir, filename);
    
    try {
      await fs.writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      logger.error('Failed to save screenshot', { error: error.message, filePath });
      throw error;
    }
  }

  async savePDF(pdfDoc, tempDir, filename = 'output.pdf') {
    const filePath = path.join(tempDir, filename);
    
    return new Promise((resolve, reject) => {
      const stream = require('fs').createWriteStream(filePath);
      
      pdfDoc.pipe(stream);
      pdfDoc.end();
      
      stream.on('finish', () => {
        resolve(filePath);
      });
      
      stream.on('error', (error) => {
        logger.error('Failed to save PDF', { error: error.message, filePath });
        reject(error);
      });
    });
  }

  async cleanupDirectory(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      logger.debug('Cleaned up directory', { dirPath });
    } catch (error) {
      logger.error('Failed to cleanup directory', { error: error.message, dirPath });
    }
  }

  async cleanupOldFiles() {
    try {
      const entries = await fs.readdir(this.tempDir, { withFileTypes: true });
      const now = Date.now();
      let cleanedCount = 0;

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(this.tempDir, entry.name);
          const stats = await fs.stat(dirPath);
          
          if (now - stats.mtime.getTime() > this.maxFileAge) {
            await this.cleanupDirectory(dirPath);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up old temp files', { count: cleanedCount });
      }
    } catch (error) {
      logger.error('Failed to cleanup old files', { error: error.message });
    }
  }

  async getDirectorySize(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let totalSize = 0;

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      logger.error('Failed to get directory size', { error: error.message, dirPath });
      return 0;
    }
  }

  async getTempStats() {
    try {
      const entries = await fs.readdir(this.tempDir, { withFileTypes: true });
      let totalDirectories = 0;
      let totalSize = 0;

      for (const entry of entries) {
        if (entry.isDirectory()) {
          totalDirectories++;
          const dirPath = path.join(this.tempDir, entry.name);
          totalSize += await this.getDirectorySize(dirPath);
        }
      }

      return {
        directories: totalDirectories,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
      };
    } catch (error) {
      logger.error('Failed to get temp stats', { error: error.message });
      return { directories: 0, totalSizeMB: 0 };
    }
  }
}

module.exports = new FileManager();