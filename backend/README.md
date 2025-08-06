# VibeSnap Backend

A robust Node.js backend service for generating high-quality PDF documents from website screenshots using Puppeteer and PDFKit.

## 🚀 Features

- **High-Quality PDF Generation**: Creates professional PDFs from any website
- **Smart Screenshot Capture**: Handles long pages with intelligent viewport splitting
- **Enhanced Error Handling**: Comprehensive error management with detailed responses
- **Security Features**: CORS protection, input validation, and request sanitization
- **Performance Optimized**: Resource blocking, cleanup routines, and memory management
- **Health Monitoring**: Built-in health check endpoint for monitoring
- **Graceful Shutdown**: Proper cleanup on server termination

## 📋 Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0

## 🛠 Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## 🚀 Getting Started

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The backend server will start on `http://localhost:5001`.

## 📡 API Endpoints

### Health Check
- **GET** `/health`
- **Response**: Server status, uptime, and memory usage

### Generate PDF
- **POST** `/api/screenshot-pdf`
- **Request Body**: 
  ```json
  {
    "url": "https://example.com"
  }
  ```
- **Response**: PDF file stream
- **Content-Type**: `application/pdf`

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
NODE_ENV=development
PORT=5001
FRONTEND_URL=http://localhost:3000
```

### CORS Configuration

The server automatically configures CORS based on the environment:
- **Development**: Allows `localhost:3000` and `127.0.0.1:3000`
- **Production**: Configure allowed origins in the CORS settings

## 🏗 Architecture

### Core Components

1. **Express Server**: RESTful API with middleware stack
2. **Puppeteer Engine**: Headless browser for website capture
3. **PDFKit Generator**: PDF creation and optimization
4. **File Management**: Temporary file handling and cleanup
5. **Error Handler**: Comprehensive error management

### Request Flow

1. **Input Validation**: URL format and security checks
2. **Browser Launch**: Puppeteer instance with optimized settings
3. **Page Capture**: Smart screenshot capture with viewport handling
4. **PDF Generation**: High-quality PDF creation with metadata
5. **File Delivery**: Streaming response with proper headers
6. **Cleanup**: Automatic temporary file removal

## 🛡 Security Features

- **Input Validation**: URL format and protocol verification
- **CORS Protection**: Configurable cross-origin resource sharing
- **Request Limits**: JSON payload size restrictions
- **Resource Blocking**: Prevents unnecessary resource loading
- **Error Sanitization**: Safe error message exposure

## 📊 Performance Optimizations

- **Resource Blocking**: Blocks fonts and media for faster loading
- **Viewport Optimization**: Intelligent screenshot splitting
- **Memory Management**: Automatic cleanup and garbage collection
- **Request Interception**: Blocks unnecessary network requests
- **Compression**: PDF compression for smaller file sizes

## 🧹 Maintenance

### Automatic Cleanup
- Temporary directories are cleaned every 30 minutes
- Files older than 1 hour are automatically removed
- Graceful shutdown ensures proper resource cleanup

### Monitoring
- Health check endpoint for service monitoring
- Detailed logging for debugging and analytics
- Memory usage tracking and reporting

## 🐛 Error Handling

The API returns structured error responses:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "Additional details (development only)"
}
```

### Common Error Codes
- `INVALID_URL`: Invalid or missing URL
- `INVALID_URL_FORMAT`: Malformed URL format
- `WEBSITE_LOAD_ERROR`: Failed to load the target website
- `TIMEOUT_ERROR`: Request timeout exceeded
- `DNS_ERROR`: Domain name resolution failed
- `INTERNAL_ERROR`: Server-side error

## 📝 Logging

The server provides comprehensive logging:
- Request logging with timestamps and IP addresses
- Error logging with stack traces
- Performance metrics and processing times
- Cleanup operation logs

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure allowed CORS origins
- [ ] Set up process manager (PM2, Docker, etc.)
- [ ] Configure reverse proxy (Nginx, Apache)
- [ ] Set up monitoring and logging
- [ ] Configure SSL/TLS certificates

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the error codes and messages
2. Review the logs for detailed information
3. Ensure all prerequisites are met
4. Verify network connectivity to target websites

## 🔄 Changelog

### v1.0.0
- Initial release with core PDF generation functionality
- Enhanced error handling and validation
- Performance optimizations and security features
- Comprehensive logging and monitoring