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

// Endpoint for screenshot + PDF of all internal pages
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

    // Collect all unique internal links (same origin)
    const baseUrl = new URL(url).origin;
    let links = await page.evaluate((base) => {
      const anchors = Array.from(document.querySelectorAll("a"));
      return anchors.map((a) => a.href).filter((href) => href.startsWith(base));
    }, baseUrl);

    // Remove duplicates & include the original URL
    links = Array.from(new Set([url, ...links])); // Limit to first 10 pages for performance

    let screenshotPaths = [];
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const page2 = await browser.newPage();
      await page2.goto(link, { waitUntil: "networkidle2", timeout: 60000 });
      const screenshotPath = path.join(tempDir, `page_${i + 1}.png`);
      await page2.screenshot({ path: screenshotPath, fullPage: true });
      screenshotPaths.push({ path: screenshotPath, url: link });
      await page2.close();
    }

    await browser.close();

    // Merge all screenshots into a single PDF
    const pdfPath = path.join(tempDir, "output.pdf");
    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    const sizeOf = require("image-size");
    for (let { path: imgPath, url: pageUrl } of screenshotPaths) {
      const { width, height } = sizeOf(imgPath);
      doc.addPage({ size: [width, height + 40] }); // Extra space for URL
      doc.fontSize(14).text(pageUrl, 10, 10); // Add page URL as header
      doc.image(imgPath, 0, 40, { width, height });
    }

    doc.end();

    stream.on("finish", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=website.pdf");
      fs.createReadStream(pdfPath).pipe(res);
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
