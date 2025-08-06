#!/usr/bin/env node

const path = require('path');
const fs = require('fs').promises;
const logger = require('../config/logger');

async function cleanup() {
  const tempDir = path.join(__dirname, '../temp');
  
  try {
    const entries = await fs.readdir(tempDir, { withFileTypes: true });
    let cleanedCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.gitkeep') {
        const dirPath = path.join(tempDir, entry.name);
        await fs.rm(dirPath, { recursive: true, force: true });
        cleanedCount++;
      }
    }

    console.log(`Cleaned up ${cleanedCount} temporary directories`);
    logger.info('Manual cleanup completed', { count: cleanedCount });
  } catch (error) {
    console.error('Cleanup failed:', error.message);
    logger.error('Manual cleanup failed', { error: error.message });
    process.exit(1);
  }
}

cleanup();