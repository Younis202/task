const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const sharp = require('sharp');
const logger = require('../config/logger');

// Add plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

class ScreenshotService {
  constructor() {
    this.browser = null;
    this.activeSessions = new Set();
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        defaultViewport: null
      });

      this.browser.on('disconnected', () => {
        logger.warn('Browser disconnected');
        this.browser = null;
      });
    }
    return this.browser;
  }

  async captureWebsite(url, options = {}, progressCallback) {
    const sessionId = Date.now().toString();
    this.activeSessions.add(sessionId);

    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      // Set viewport based on options
      const viewport = this.getViewportSettings(options);
      await page.setViewport(viewport);

      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Block unnecessary resources for faster loading
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        const blockedTypes = ['font', 'media', 'websocket'];
        
        if (blockedTypes.includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Enhanced error handling for page navigation
      const navigationPromise = page.goto(url, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
      }).catch(async (error) => {
        // Retry with different wait conditions
        logger.warn('Initial navigation failed, retrying', { error: error.message, url });
        return page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      });

      await navigationPromise;
      progressCallback && progressCallback(20, 'Page loaded successfully');

      // Wait for dynamic content
      await this.waitForDynamicContent(page);
      progressCallback && progressCallback(30, 'Dynamic content loaded');

      // Remove unwanted elements
      await this.cleanupPage(page, options);
      progressCallback && progressCallback(40, 'Page cleaned and optimized');

      // Get page dimensions
      const dimensions = await page.evaluate(() => {
        return {
          width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
          viewportHeight: window.innerHeight
        };
      });

      progressCallback && progressCallback(50, 'Analyzing page structure');

      // Capture screenshots with smooth scrolling
      const screenshots = await this.captureScrollingScreenshots(
        page, 
        dimensions, 
        viewport, 
        options,
        progressCallback
      );

      await page.close();
      this.activeSessions.delete(sessionId);

      return {
        screenshots,
        metadata: {
          url,
          dimensions,
          timestamp: new Date().toISOString(),
          sessionId
        }
      };

    } catch (error) {
      this.activeSessions.delete(sessionId);
      logger.error('Screenshot capture failed', { error: error.message, url, sessionId });
      throw new Error(`Failed to capture website: ${error.message}`);
    }
  }

  getViewportSettings(options) {
    const { quality = 'medium' } = options;
    
    const viewportSettings = {
      low: { width: 1024, height: 768 },
      medium: { width: 1280, height: 1024 },
      high: { width: 1920, height: 1080 }
    };

    return viewportSettings[quality] || viewportSettings.medium;
  }

  async waitForDynamicContent(page) {
    // Wait for common dynamic content indicators
    try {
      await page.waitForFunction(() => {
        // Check if page is still loading
        return document.readyState === 'complete';
      }, { timeout: 10000 });

      // Wait for images to load
      await page.waitForFunction(() => {
        const images = Array.from(document.images);
        return images.every(img => img.complete);
      }, { timeout: 15000 }).catch(() => {
        logger.warn('Some images may not have loaded completely');
      });

      // Wait for any lazy loading
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, 100);
        });
      });

    } catch (error) {
      logger.warn('Dynamic content loading timeout', { error: error.message });
    }
  }

  async cleanupPage(page, options) {
    const { aiOptimize = false } = options;

    // Remove common unwanted elements
    await page.evaluate(() => {
      const selectorsToRemove = [
        'script[src*="google-analytics"]',
        'script[src*="googletagmanager"]',
        'script[src*="facebook.net"]',
        '.cookie-banner',
        '.cookie-notice',
        '.gdpr-banner',
        '[class*="popup"]',
        '[class*="modal"]',
        '[id*="popup"]',
        '[id*="modal"]',
        '.advertisement',
        '.ad-banner',
        '[class*="ad-"]',
        '.social-share-popup'
      ];

      selectorsToRemove.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // Hide fixed/sticky elements that might interfere
      const fixedElements = document.querySelectorAll('*');
      fixedElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          if (el.tagName !== 'BODY' && el.tagName !== 'HTML') {
            el.style.display = 'none';
          }
        }
      });
    });

    // Additional AI-powered cleanup if enabled
    if (aiOptimize) {
      await this.aiPoweredCleanup(page);
    }
  }

  async aiPoweredCleanup(page) {
    // AI-powered content detection and cleanup
    await page.evaluate(() => {
      // Remove elements with low content value
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const text = el.textContent?.trim() || '';
        const hasImages = el.querySelectorAll('img').length > 0;
        const hasLinks = el.querySelectorAll('a').length > 0;
        
        // Remove elements that are likely ads or low-value content
        if (text.length < 10 && !hasImages && !hasLinks && 
            el.children.length === 0 && 
            !['IMG', 'BR', 'HR'].includes(el.tagName)) {
          el.remove();
        }
      });
    });
  }

  async captureScrollingScreenshots(page, dimensions, viewport, options, progressCallback) {
    const screenshots = [];
    const { height: pageHeight } = dimensions;
    const viewportHeight = viewport.height;
    const overlap = 50; // Overlap between screenshots for seamless merging
    const scrollStep = viewportHeight - overlap;

    let currentScroll = 0;
    let screenshotIndex = 0;
    const totalSteps = Math.ceil(pageHeight / scrollStep);

    while (currentScroll < pageHeight) {
      // Smooth scroll to position
      await page.evaluate((scrollY) => {
        window.scrollTo({
          top: scrollY,
          behavior: 'smooth'
        });
      }, currentScroll);

      // Wait for smooth scroll to complete
      await new Promise(resolve => setTimeout(resolve, 800));

      // Wait for any lazy-loaded content
      await page.waitForTimeout(200);

      // Take screenshot
      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: viewport.width,
          height: Math.min(viewportHeight, pageHeight - currentScroll)
        }
      });

      screenshots.push(screenshotBuffer);
      screenshotIndex++;

      // Update progress
      const progress = 50 + (screenshotIndex / totalSteps) * 40;
      progressCallback && progressCallback(
        Math.round(progress), 
        `Capturing screenshot ${screenshotIndex} of ${totalSteps}`
      );

      currentScroll += scrollStep;
    }

    // Merge overlapping screenshots for seamless result
    return await this.mergeScreenshots(screenshots, overlap);
  }

  async mergeScreenshots(screenshots, overlap) {
    if (screenshots.length <= 1) return screenshots;

    const mergedScreenshots = [];
    
    for (let i = 0; i < screenshots.length; i++) {
      let screenshot = screenshots[i];
      
      if (i > 0 && overlap > 0) {
        // Remove overlap from top of current screenshot
        const image = sharp(screenshot);
        const metadata = await image.metadata();
        
        screenshot = await image
          .extract({
            left: 0,
            top: overlap,
            width: metadata.width,
            height: metadata.height - overlap
          })
          .png()
          .toBuffer();
      }
      
      mergedScreenshots.push(screenshot);
    }

    return mergedScreenshots;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getActiveSessionsCount() {
    return this.activeSessions.size;
  }
}

module.exports = new ScreenshotService();