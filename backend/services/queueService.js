const Queue = require('bull');
const redis = require('redis');
const logger = require('../config/logger');

class QueueService {
  constructor() {
    this.redisClient = null;
    this.pdfQueue = null;
    this.init();
  }

  async init() {
    try {
      // Initialize Redis client
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      // Initialize Bull queue
      this.pdfQueue = new Queue('PDF Generation', process.env.REDIS_URL || 'redis://localhost:6379', {
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      // Queue event handlers
      this.pdfQueue.on('completed', (job, result) => {
        logger.info('Job completed', { jobId: job.id, duration: Date.now() - job.timestamp });
      });

      this.pdfQueue.on('failed', (job, err) => {
        logger.error('Job failed', { jobId: job.id, error: err.message });
      });

      this.pdfQueue.on('stalled', (job) => {
        logger.warn('Job stalled', { jobId: job.id });
      });

    } catch (error) {
      logger.error('Queue service initialization failed', { error: error.message });
      // Fallback to in-memory processing if Redis is not available
      this.useInMemoryFallback = true;
    }
  }

  async addJob(jobData, options = {}) {
    if (this.useInMemoryFallback || !this.pdfQueue) {
      // Process immediately if queue is not available
      return { id: Date.now().toString(), data: jobData };
    }

    try {
      const job = await this.pdfQueue.add('generatePDF', jobData, {
        priority: options.priority || 0,
        delay: options.delay || 0,
        ...options
      });

      return job;
    } catch (error) {
      logger.error('Failed to add job to queue', { error: error.message });
      throw error;
    }
  }

  async getJob(jobId) {
    if (this.useInMemoryFallback || !this.pdfQueue) {
      return null;
    }

    try {
      return await this.pdfQueue.getJob(jobId);
    } catch (error) {
      logger.error('Failed to get job', { jobId, error: error.message });
      return null;
    }
  }

  async getQueueStats() {
    if (this.useInMemoryFallback || !this.pdfQueue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      };
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.pdfQueue.getWaiting(),
        this.pdfQueue.getActive(),
        this.pdfQueue.getCompleted(),
        this.pdfQueue.getFailed(),
        this.pdfQueue.getDelayed()
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length
      };
    } catch (error) {
      logger.error('Failed to get queue stats', { error: error.message });
      return null;
    }
  }

  async cleanup() {
    if (this.pdfQueue) {
      await this.pdfQueue.close();
    }
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

module.exports = new QueueService();