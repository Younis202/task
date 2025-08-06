const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

class PDFService {
  constructor() {
    this.pageFormats = {
      'A4': [595, 842],
      'Letter': [612, 792],
      'Legal': [612, 1008],
      'A3': [842, 1191]
    };
  }

  async createPDF(screenshots, options = {}, metadata = {}) {
    const {
      format = 'A4',
      orientation = 'portrait',
      quality = 'high',
      margins = { top: 50, bottom: 50, left: 50, right: 50 }
    } = options;

    const pageSize = this.pageFormats[format] || this.pageFormats['A4'];
    const [width, height] = orientation === 'landscape' ? [pageSize[1], pageSize[0]] : pageSize;

    const doc = new PDFDocument({
      size: [width, height],
      margins,
      info: {
        Title: metadata.title || 'Website PDF',
        Author: metadata.author || 'VibeSnap AI',
        Subject: metadata.subject || 'Generated PDF',
        Keywords: metadata.keywords ? metadata.keywords.join(', ') : '',
        Creator: metadata.creator || 'VibeSnap v2.0',
        Producer: metadata.producer || 'VibeSnap AI Engine'
      },
      compress: quality !== 'high'
    });

    // Add header and footer if metadata available
    if (metadata.title) {
      this.addHeader(doc, metadata.title, width, margins);
    }

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      
      try {
        // Optimize image based on quality setting
        const optimizedImage = await this.optimizeImage(screenshot, quality, width - margins.left - margins.right);
        
        if (i > 0) {
          doc.addPage();
        }

        // Calculate image dimensions to fit page
        const imageInfo = await sharp(optimizedImage).metadata();
        const maxWidth = width - margins.left - margins.right;
        const maxHeight = height - margins.top - margins.bottom - 60; // Reserve space for header/footer

        let imgWidth = imageInfo.width;
        let imgHeight = imageInfo.height;

        // Scale image to fit page
        if (imgWidth > maxWidth) {
          const scale = maxWidth / imgWidth;
          imgWidth = maxWidth;
          imgHeight = imgHeight * scale;
        }

        if (imgHeight > maxHeight) {
          const scale = maxHeight / imgHeight;
          imgHeight = maxHeight;
          imgWidth = imgWidth * scale;
        }

        // Center image on page
        const x = margins.left + (maxWidth - imgWidth) / 2;
        const y = margins.top + 30; // Account for header

        doc.image(optimizedImage, x, y, {
          width: imgWidth,
          height: imgHeight
        });

        // Add page number
        this.addFooter(doc, i + 1, screenshots.length, width, height, margins);

      } catch (error) {
        logger.error('Error processing screenshot', { error: error.message, index: i });
        // Continue with next image
      }
    }

    return doc;
  }

  async optimizeImage(imagePath, quality, maxWidth) {
    const qualitySettings = {
      low: { jpeg: { quality: 60 }, png: { compressionLevel: 8 } },
      medium: { jpeg: { quality: 80 }, png: { compressionLevel: 6 } },
      high: { jpeg: { quality: 95 }, png: { compressionLevel: 3 } }
    };

    const settings = qualitySettings[quality] || qualitySettings.medium;
    
    const sharpInstance = sharp(imagePath)
      .resize(maxWidth, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      });

    // Determine output format and apply compression
    const metadata = await sharpInstance.metadata();
    if (metadata.format === 'png') {
      return await sharpInstance.png(settings.png).toBuffer();
    } else {
      return await sharpInstance.jpeg(settings.jpeg).toBuffer();
    }
  }

  addHeader(doc, title, pageWidth, margins) {
    doc.fontSize(12)
       .fillColor('#666666')
       .text(title, margins.left, margins.top - 30, {
         width: pageWidth - margins.left - margins.right,
         align: 'center'
       });
    
    // Add line under header
    doc.moveTo(margins.left, margins.top - 10)
       .lineTo(pageWidth - margins.right, margins.top - 10)
       .strokeColor('#cccccc')
       .stroke();
  }

  addFooter(doc, pageNum, totalPages, pageWidth, pageHeight, margins) {
    const footerY = pageHeight - margins.bottom + 20;
    
    // Add line above footer
    doc.moveTo(margins.left, footerY - 10)
       .lineTo(pageWidth - margins.right, footerY - 10)
       .strokeColor('#cccccc')
       .stroke();

    // Add page number and timestamp
    doc.fontSize(10)
       .fillColor('#666666')
       .text(`Page ${pageNum} of ${totalPages}`, margins.left, footerY, { align: 'left' })
       .text(`Generated on ${new Date().toLocaleDateString()}`, margins.left, footerY, { 
         width: pageWidth - margins.left - margins.right,
         align: 'right' 
       });
  }
}

module.exports = new PDFService();