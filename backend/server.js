const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

// دالة السكرول البسيطة والمضمونة
async function scrollPageGradually(page, maxScrolls = 15) {
  console.log("🔄 Starting gradual scroll...");

  try {
    await page.evaluate(async (scrollCount) => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      for (let i = 0; i < scrollCount; i++) {
        window.scrollBy(0, window.innerHeight * 0.8);
        await delay(200); // استنى 200ms بين كل scroll

        // لو وصلنا للآخر، طلع من الloop
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
          console.log("Reached bottom at scroll", i + 1);
          break;
        }
      }

      // ارجع للأعلى
      window.scrollTo(0, 0);
      await delay(500);
    }, maxScrolls);

    console.log("✅ Scrolling completed");
    return true;
  } catch (error) {
    console.log("⚠️ Scrolling failed:", error.message);
    return false;
  }
}

// دالة انتظار تحميل المحتوى البسيطة
async function waitForContent(page, waitTime = 2000) {
  console.log(`⏳ Waiting ${waitTime}ms for content...`);

  try {
    // استنى الوقت المحدد
    await page.waitForTimeout(waitTime);

    // جرب تستنى أي صور lazy loading (مع timeout قصير)
    await page
      .evaluate(() => {
        return new Promise((resolve) => {
          const images = document.querySelectorAll(
            'img[loading="lazy"], img[data-src]'
          );
          let loadedCount = 0;
          const totalImages = images.length;

          if (totalImages === 0) {
            resolve();
            return;
          }

          const checkComplete = () => {
            loadedCount++;
            if (loadedCount >= totalImages) {
              resolve();
            }
          };

          images.forEach((img) => {
            if (img.complete) {
              checkComplete();
            } else {
              img.addEventListener("load", checkComplete, { once: true });
              img.addEventListener("error", checkComplete, { once: true });
            }
          });

          // timeout بعد 3 ثواني في كل الأحوال
          setTimeout(resolve, 3000);
        });
      })
      .catch(() => {
        console.log("⚠️ Content waiting failed, continuing anyway");
      });

    console.log("✅ Content loading completed");
  } catch (error) {
    console.log("⚠️ Content waiting error:", error.message);
  }
}

app.post("/api/screenshot-pdf", async (req, res) => {
  const { url, scrollDepth = 10, waitTime = 3000, maxLinks = 3 } = req.body;

  if (!url) {
    return res.status(400).json({ error: "No URL provided" });
  }

  const tempDir = path.join(__dirname, "temp", uuidv4());
  let browser = null;

  try {
    console.log("🚀 Starting PDF generation for:", url);

    // إنشاء مجلد مؤقت
    fs.mkdirSync(tempDir, { recursive: true });

    // فتح البراوزر بإعدادات بسيطة
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // حجم شاشة معقول
    await page.setViewport({
      width: 1200,
      height: 800,
    });

    console.log("📄 Loading main page...");

    // تحميل الصفحة الرئيسية
    try {
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });
    } catch (error) {
      // لو networkidle0 مش شغال، جرب domcontentloaded
      console.log("⚠️ Retrying with domcontentloaded...");
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    }

    // عمل scroll تدريجي
    await scrollPageGradually(page, scrollDepth);

    // انتظار المحتوى
    await waitForContent(page, waitTime);

    // جمع الروابط الداخلية (بحد أقصى)
    let links = [url];

    try {
      console.log("🔗 Collecting internal links...");
      const baseUrl = new URL(url).origin;
      const foundLinks = await page.evaluate(
        (baseUrl, maxCount) => {
          const anchors = Array.from(document.querySelectorAll("a[href]"));
          return anchors
            .map((a) => a.href)
            .filter(
              (href) =>
                href &&
                href.startsWith(baseUrl) &&
                href !== window.location.href
            )
            .slice(0, maxCount);
        },
        baseUrl,
        maxLinks
      );

      links = [url, ...foundLinks];
      console.log(`✅ Found ${links.length} total links to process`);
    } catch (error) {
      console.log("⚠️ Link collection failed, using main page only");
    }

    // أخذ screenshots
    console.log("📸 Taking screenshots...");
    let screenshotPaths = [];

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      console.log(`📷 Processing ${i + 1}/${links.length}: ${link}`);

      try {
        if (i > 0) {
          // للصفحات الإضافية، افتح صفحة جديدة
          await page.goto(link, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });

          // scroll أقل للصفحات الإضافية
          await scrollPageGradually(page, Math.min(scrollDepth, 5));
          await waitForContent(page, Math.min(waitTime, 2000));
        }

        const screenshotPath = path.join(tempDir, `page_${i + 1}.png`);
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          type: "png",
        });

        screenshotPaths.push(screenshotPath);
        console.log(`✅ Screenshot ${i + 1} captured`);
      } catch (error) {
        console.log(`❌ Failed to capture ${link}:`, error.message);
        continue;
      }
    }

    await browser.close();
    browser = null;

    if (screenshotPaths.length === 0) {
      throw new Error("No screenshots were captured successfully");
    }

    console.log("🖼️ Processing images...");

    // قراءة كل الصور
    const imageBuffers = [];
    const imageSizes = [];

    for (const imgPath of screenshotPaths) {
      try {
        const buffer = await fs.promises.readFile(imgPath);
        const image = sharp(buffer);
        const metadata = await image.metadata();

        imageBuffers.push(buffer);
        imageSizes.push({ width: metadata.width, height: metadata.height });
      } catch (error) {
        console.log("⚠️ Skipping corrupted image:", imgPath);
      }
    }

    if (imageBuffers.length === 0) {
      throw new Error("No valid images to process");
    }

    // حساب الأبعاد الإجمالية
    const maxWidth = Math.max(...imageSizes.map((s) => s.width));
    const totalHeight = imageSizes.reduce((sum, s) => sum + s.height, 0);

    console.log(`📐 Combined image size: ${maxWidth}x${totalHeight}px`);

    // تنسيق الصور وتجميعها
    const resizedBuffers = [];
    for (let i = 0; i < imageBuffers.length; i++) {
      const resized = await sharp(imageBuffers[i])
        .resize({ width: maxWidth, fit: "contain", background: "#ffffff" })
        .png()
        .toBuffer();
      resizedBuffers.push(resized);
    }

    // إنشاء الصورة المجمعة
    const compositeImages = [];
    let currentTop = 0;

    for (let i = 0; i < resizedBuffers.length; i++) {
      compositeImages.push({
        input: resizedBuffers[i],
        top: currentTop,
        left: 0,
      });
      currentTop += imageSizes[i].height;
    }

    const combinedImagePath = path.join(tempDir, "combined.png");
    await sharp({
      create: {
        width: maxWidth,
        height: totalHeight,
        channels: 4,
        background: "#ffffff",
      },
    })
      .composite(compositeImages)
      .png()
      .toFile(combinedImagePath);

    console.log("📄 Creating PDF...");

    // إنشاء PDF
    const pdfPath = path.join(tempDir, "website.pdf");
    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    // تحديد حجم PDF (تصغير لو كان كبير أوي)
    let pdfWidth = maxWidth;
    let pdfHeight = totalHeight;
    const maxSize = 14400; // حد أقصى للحجم

    if (pdfWidth > maxSize || pdfHeight > maxSize) {
      const scale = Math.min(maxSize / pdfWidth, maxSize / pdfHeight);
      pdfWidth *= scale;
      pdfHeight *= scale;
    }

    doc.addPage({ size: [pdfWidth, pdfHeight] });
    doc.image(combinedImagePath, 0, 0, { width: pdfWidth, height: pdfHeight });
    doc.end();

    // إرسال PDF للمستخدم
    stream.on("finish", () => {
      console.log("✅ PDF generation completed successfully!");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=website_${Date.now()}.pdf`
      );

      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);

      // تنظيف الملفات بعد الإرسال
      fileStream.on("end", () => {
        setTimeout(() => {
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log("🧹 Temporary files cleaned up");
          } catch (cleanupError) {
            console.log("⚠️ Cleanup warning:", cleanupError.message);
          }
        }, 5000);
      });
    });

    stream.on("error", (streamError) => {
      console.error("❌ PDF stream error:", streamError);
      throw streamError;
    });
  } catch (error) {
    console.error("❌ Main error:", error.message);
    console.error("❌ Stack trace:", error.stack);

    // تنظيف في حالة الخطأ
    if (browser) {
      try {
        await browser.close();
      } catch (browserError) {
        console.log("⚠️ Browser cleanup error:", browserError.message);
      }
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.log("⚠️ Temp cleanup error:", cleanupError.message);
    }

    res.status(500).json({
      error: "Failed to process website",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is working!" });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log("🚀 Simple PDF Generator Server Started");
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
});
