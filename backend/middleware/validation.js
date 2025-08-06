const { body, validationResult } = require('express-validator');
const logger = require('../config/logger');

const urlValidation = [
  body('url')
    .isURL({ 
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false
    })
    .withMessage('Invalid URL format')
    .custom((value) => {
      // Block localhost and private IPs for security
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase();
      
      if (hostname === 'localhost' || 
          hostname.startsWith('127.') || 
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        throw new Error('Private/local URLs are not allowed');
      }
      
      // Block suspicious domains
      const suspiciousDomains = ['bit.ly', 'tinyurl.com', 'short.link'];
      if (suspiciousDomains.some(domain => hostname.includes(domain))) {
        throw new Error('Shortened URLs are not allowed');
      }
      
      return true;
    }),
  
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
    
  body('options.format')
    .optional()
    .isIn(['A4', 'Letter', 'Legal', 'A3'])
    .withMessage('Invalid page format'),
    
  body('options.orientation')
    .optional()
    .isIn(['portrait', 'landscape'])
    .withMessage('Invalid orientation'),
    
  body('options.quality')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid quality setting'),
    
  body('options.aiOptimize')
    .optional()
    .isBoolean()
    .withMessage('AI optimize must be boolean')
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', { 
      errors: errors.array(), 
      ip: req.ip,
      url: req.body.url 
    });
    
    return res.status(400).json({
      error: 'Invalid request parameters',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

module.exports = {
  urlValidation,
  handleValidationErrors
};