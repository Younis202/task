require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const fs = require("fs");
const path = require("path");

// Services
const logger = require("./config/logger");
const screenshotService = require("./services/screenshotService");
const pdfService = require("./services/pdfService");
const aiService = require("./services/aiService");
const queueService = require("./services/queueService");
const fileManager = require("./utils/fileManager");

// Middleware
const {
  urlValidation,
  handleValidationErrors,
} = require("./middleware/validation");

const app = express();

// Create logs directory
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false,
  })
);

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 10,
  message: {
    error: "Too many requests",
    code: "RATE_LIMIT_EXCEEDED",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.FRONTEND_URL
      ? [
          process.env.FRONTEND_URL,
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ]
      : ["http://localhost:3000", "http://127.0.0.1:3000"];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
  });

  next();
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const queueStats = await queueService.getQueueStats();
    const tempStats = await fileManager.getTempStats();
    const activeScreenshots = screenshotService.getActiveSessionsCount();

    const healthData = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      queue: queueStats,
      temp: tempStats,
      activeSessions: activeScreenshots,
      version: "2.0.0",
      features: {
        ai: !!process.env.OPENAI_API_KEY,
        queue: !queueService.useInMemoryFallback,
        redis: !queueService.useInMemoryFallback,
      },
    };

    res.json(healthData);
  } catch (error) {
    logger.error("Health check failed", { error: error.message });
    res.status(500).json({
      status: "unhealthy",
      error: "Health check failed",
    });
  }
});

// Queue status endpoint
app.get("/api/queue/stats", async (req, res) => {
  try {
    const stats = await queueService.getQueueStats();
    res.json(stats);
  } catch (error) {
    logger.error("Failed to get queue stats", { error: error.message });
    res.status(500).json({
      error: "Failed to get queue statistics",
      code: "QUEUE_STATS_ERROR",
    });
  }
});

// Job status endpoint
app.get("/api/job/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await queueService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found",
        code: "JOB_NOT_FOUND",
      });
    }

    res.json({
      id: job.id,
      status: await job.getState(),
      progress: job.progress(),
      data: job.data,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
    });
  } catch (error) {
    logger.error("Failed to get job status", {
      error: error.message,
      jobId: req.params.jobId,
    });
    res.status(500).json({
      error: "Failed to get job status",
      code: "JOB_STATUS_ERROR",
    });
  }
});

// Main PDF generation endpoint
app.post(
  "/api/screenshot-pdf",
  urlValidation,
  handleValidationErrors,
  async (req, res) => {
    const startTime = Date.now();
    const { url, options = {} } = req.body;
    let tempDir = null;

    // Set response headers for streaming
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="website-snapshot.pdf"'
    );
    res.setHeader("Cache-Control", "no-cache");

    try {
      logger.info("PDF generation started", { url, options, ip: req.ip });

      // Create temporary directory
      tempDir = await fileManager.createTempDirectory();

      // Progress tracking
      let currentProgress = 0;
      const updateProgress = (progress, message) => {
        currentProgress = progress;
        logger.debug("Progress update", { progress, message, url });
      };

      // Step 1: Capture website screenshots
      updateProgress(10, "Initializing browser");
      const captureResult = await screenshotService.captureWebsite(
        url,
        options,
        updateProgress
      );
      const { screenshots, metadata } = captureResult;

      updateProgress(90, "Processing screenshots");

      // Step 2: AI content analysis (if enabled)
      let contentAnalysis = null;
      let pdfMetadata = null;

      if (options.aiOptimize && process.env.OPENAI_API_KEY) {
        try {
          // Get page HTML for AI analysis
          const puppeteer = require("puppeteer-extra");
          const browser = await puppeteer.launch({ headless: "new" });
          const page = await browser.newPage();
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          const html = await page.content();
          await browser.close();

          contentAnalysis = await aiService.analyzeContent(html, url);
          pdfMetadata = await aiService.generateMetadata(contentAnalysis, url);

          logger.info("AI analysis completed", {
            title: contentAnalysis.title,
            wordCount: contentAnalysis.wordCount,
            url,
          });
        } catch (aiError) {
          logger.warn("AI analysis failed, continuing without AI features", {
            error: aiError.message,
            url,
          });
        }
      }

      // Step 3: Save screenshots to temp files
      const screenshotPaths = [];
      for (let i = 0; i < screenshots.length; i++) {
        const filename = `screenshot_${i}.png`;
        const filePath = await fileManager.saveScreenshot(
          screenshots[i],
          tempDir,
          filename
        );
        screenshotPaths.push(filePath);
      }

      updateProgress(95, "Generating PDF");

      // Step 4: Create PDF
      const pdfDoc = await pdfService.createPDF(
        screenshotPaths,
        options,
        pdfMetadata
      );

      // Step 5: Stream PDF to response
      pdfDoc.pipe(res);
      pdfDoc.end();

      // Cleanup after response is sent
      res.on("finish", async () => {
        const duration = Date.now() - startTime;
        logger.info("PDF generation completed", {
          url,
          duration: `${duration}ms`,
          screenshots: screenshots.length,
          aiEnabled: !!contentAnalysis,
          tempDir,
        });

        // Cleanup temp directory after a delay
        setTimeout(async () => {
          await fileManager.cleanupDirectory(tempDir);
        }, 5000);
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("PDF generation failed", {
        error: error.message,
        stack: error.stack,
        url,
        duration: `${duration}ms`,
        tempDir,
      });

      // Cleanup on error
      if (tempDir) {
        await fileManager.cleanupDirectory(tempDir);
      }

      // Send appropriate error response
      if (!res.headersSent) {
        let errorCode = "INTERNAL_ERROR";
        let statusCode = 500;

        if (error.message.includes("timeout")) {
          errorCode = "TIMEOUT_ERROR";
          statusCode = 408;
        } else if (error.message.includes("navigation")) {
          errorCode = "WEBSITE_LOAD_ERROR";
          statusCode = 400;
        } else if (
          error.message.includes("DNS") ||
          error.message.includes("ENOTFOUND")
        ) {
          errorCode = "DNS_ERROR";
          statusCode = 400;
        }

        res.status(statusCode).json({
          error: "Failed to generate PDF",
          code: errorCode,
          details:
            process.env.NODE_ENV === "development" ? error.message : undefined,
          url: url,
        });
      }
    }
  }
);

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error("Unhandled error", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    code: "NOT_FOUND",
    path: req.path,
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    await screenshotService.cleanup();
    await queueService.cleanup();
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", { error: error.message });
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  logger.info("VibeSnap AI PDF Generator started", {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    features: {
      ai: !!process.env.OPENAI_API_KEY,
      redis: !!process.env.REDIS_URL,
    },
  });
});

// Handle server errors
server.on("error", (error) => {
  logger.error("Server error", { error: error.message });
});

module.exports = app;
