const OpenAI = require('openai');
const cheerio = require('cheerio');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const logger = require('../config/logger');

class AIService {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;
    
    if (!this.openai) {
      logger.warn('OpenAI API key not provided. AI features will be disabled.');
    }
  }

  async analyzeContent(html, url) {
    try {
      if (!this.openai) {
        return this.fallbackContentAnalysis(html);
      }

      // Extract readable content using Readability
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        return this.fallbackContentAnalysis(html);
      }

      // Use AI to analyze and optimize content
      const prompt = `
        Analyze this webpage content and provide optimization suggestions for PDF generation:
        
        Title: ${article.title}
        Content: ${article.textContent.substring(0, 2000)}...
        
        Please provide:
        1. Main content areas to focus on
        2. Elements to exclude (ads, navigation, etc.)
        3. Suggested page breaks
        4. Content summary
        
        Respond in JSON format.
      `;

      const response = await this.openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      });

      const aiAnalysis = JSON.parse(response.choices[0].message.content);
      
      return {
        title: article.title,
        excerpt: article.excerpt,
        readableContent: article.content,
        aiSuggestions: aiAnalysis,
        wordCount: article.textContent.split(' ').length,
        estimatedReadTime: Math.ceil(article.textContent.split(' ').length / 200)
      };

    } catch (error) {
      logger.error('AI content analysis failed', { error: error.message, url });
      return this.fallbackContentAnalysis(html);
    }
  }

  fallbackContentAnalysis(html) {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, .ad, .advertisement, .popup').remove();
    
    const title = $('title').text() || $('h1').first().text() || 'Untitled';
    const content = $('body').text().trim();
    
    return {
      title,
      excerpt: content.substring(0, 200) + '...',
      readableContent: $('body').html(),
      aiSuggestions: {
        mainContentAreas: ['main', 'article', '.content'],
        elementsToExclude: ['nav', 'header', 'footer', '.ad', '.sidebar'],
        suggestedPageBreaks: ['h1', 'h2'],
        contentSummary: 'Standard webpage content extraction'
      },
      wordCount: content.split(' ').length,
      estimatedReadTime: Math.ceil(content.split(' ').length / 200)
    };
  }

  async generateMetadata(contentAnalysis, url) {
    const metadata = {
      title: contentAnalysis.title,
      subject: `PDF generated from ${new URL(url).hostname}`,
      author: 'VibeSnap AI PDF Generator',
      creator: 'VibeSnap v2.0',
      producer: 'VibeSnap AI Engine',
      creationDate: new Date(),
      keywords: [],
      description: contentAnalysis.excerpt
    };

    if (this.openai && contentAnalysis.readableContent) {
      try {
        const prompt = `Extract 5-10 relevant keywords from this content for PDF metadata: ${contentAnalysis.excerpt}`;
        
        const response = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100
        });

        const keywords = response.choices[0].message.content
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0);
          
        metadata.keywords = keywords;
      } catch (error) {
        logger.warn('Failed to generate AI keywords', { error: error.message });
      }
    }

    return metadata;
  }
}

module.exports = new AIService();