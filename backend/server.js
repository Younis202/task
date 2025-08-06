const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint for screenshot + PDF
app.post("/api/screenshot-pdf", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  const tempDir = path.join(__dirname, "temp", uuidv4());
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Get page height for scrolling and splitting
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);

    // Split the page into viewport-sized screenshots for smoothness
    const viewportHeight = 1200;
    await page.setViewport({ width: 1280, height: viewportHeight });

    let screenshots = [];
    for (let offset = 0; offset < pageHeight; offset += viewportHeight) {
      await page.evaluate((_offset) => window.scrollTo(0, _offset), offset);
      await new Promise((r) => setTimeout(r, 400)); // allow for smooth scroll

      const screenshotPath = path.join(tempDir, `part_${offset}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      screenshots.push(screenshotPath);
    }

    await browser.close();

    // Merge screenshots into PDF
    const pdfPath = path.join(tempDir, "output.pdf");
    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    for (let imgPath of screenshots) {
      // Use sharp to get image size (PDFKit doesn't read PNG size directly)
      const sizeOf = require("image-size");
      const { width, height } = sizeOf(imgPath);
      doc.addPage({ size: [width, height] });
      doc.image(imgPath, 0, 0, { width, height });
    }

    doc.end();

    stream.on("finish", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=website.pdf");
      fs.createReadStream(pdfPath).pipe(res);
      // Clean up temp files after some time
      setTimeout(
        () => fs.rmSync(tempDir, { recursive: true, force: true }),
        60000
      );
    });
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    res
      .status(500)
      .json({ error: "Failed to process the website", details: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
