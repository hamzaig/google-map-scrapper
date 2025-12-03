const puppeteer = require('puppeteer');

/**
 * Extract email from a website
 * @param {string} websiteUrl - Website URL to extract email from
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<string|null>} Extracted email or null
 */
async function extractEmailFromWebsite(websiteUrl, timeout = 10000) {
  let browser;
  
  try {
    // Validate URL
    if (!websiteUrl || !websiteUrl.startsWith('http')) {
      console.log(`Invalid URL: ${websiteUrl}`);
      return null;
    }

    // Skip Google Maps URLs - these are not actual business websites
    if (websiteUrl.includes('google.com/maps') || websiteUrl.includes('maps.google.com')) {
      console.log(`⏭️  Skipping Google Maps URL: ${websiteUrl}`);
      return null;
    }

    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode to avoid deprecation warning
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--ignore-certificate-errors', // Ignore SSL certificate errors
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list'
      ]
    });

    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Ignore SSL errors
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      request.continue();
    });

    // Set timeout
    await page.setDefaultTimeout(timeout);

    console.log(`🌐 Visiting: ${websiteUrl}`);
    
    // Navigate to website with error handling
    try {
      await page.goto(websiteUrl, { 
        waitUntil: 'domcontentloaded', // Changed from networkidle2 to faster loading
        timeout: timeout,
        ignoreHTTPSErrors: true // Ignore SSL errors
      });
    } catch (navError) {
      // If navigation fails, try with load event
      try {
        await page.goto(websiteUrl, { 
          waitUntil: 'load',
          timeout: timeout,
          ignoreHTTPSErrors: true
        });
      } catch (loadError) {
        console.log(`⚠️  Navigation issue for ${websiteUrl}, trying to extract from partial content...`);
        // Continue anyway, might have partial content
      }
    }

    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);

    // Extract email from page content
    const email = await page.evaluate(() => {
      // Email regex pattern
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      
      // Get all text content from the page
      const bodyText = document.body.innerText || document.body.textContent || '';
      
      // Find all email matches
      const emails = bodyText.match(emailRegex) || [];
      
      // Excluded domains (common false positives)
      const excludedDomains = [
        'example.com', 'test.com', 'domain.com', 'yourdomain.com', 'email.com',
        'sentry', 'wix', 'facebook', 'google', 'twitter', 'linkedin', 'instagram',
        'youtube', 'pinterest', 'tumblr', 'reddit', 'github', 'stackoverflow',
        'amazon', 'microsoft', 'apple', 'adobe', 'cloudflare', 'cdn', 'analytics',
        'tracking', 'pixel', 'doubleclick', 'googletagmanager', 'google-analytics',
        'gstatic', 'gmail', 'yahoo', 'hotmail', 'outlook', 'live.com', 'msn.com',
        'aol.com', 'mail.com', 'protonmail', 'zoho', 'yandex', 'mail.ru',
        'qq.com', '163.com', 'sina.com', 'sohu.com', '126.com', 'yeah.net',
        'foxmail.com', 'placeholder', 'example', 'test', 'domain', 'yourdomain', 'email'
      ];
      
      // Filter out common false positives
      const filteredEmails = emails.filter(email => {
        const lowerEmail = email.toLowerCase();
        return !excludedDomains.some(domain => lowerEmail.includes(domain));
      });
      
      // Also check in href attributes (mailto links)
      const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
      mailtoLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          const emailMatch = href.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
          if (emailMatch && emailMatch[1]) {
            filteredEmails.push(emailMatch[1]);
          }
        }
      });
      
      // Remove duplicates
      const uniqueEmails = [...new Set(filteredEmails)];
      
      // Return the first valid email (usually the contact email)
      // Prefer emails that contain 'contact', 'info', 'hello', 'support', 'sales'
      const priorityEmails = uniqueEmails.filter(email => {
        const lower = email.toLowerCase();
        return lower.includes('contact') || 
               lower.includes('info') || 
               lower.includes('hello') || 
               lower.includes('support') || 
               lower.includes('sales') ||
               lower.includes('admin') ||
               lower.includes('office');
      });
      
      return priorityEmails.length > 0 ? priorityEmails[0] : (uniqueEmails[0] || null);
    });

    if (email) {
      console.log(`✅ Email found: ${email} from ${websiteUrl}`);
      return email;
    } else {
      console.log(`❌ No email found on ${websiteUrl}`);
      return null;
    }

  } catch (error) {
    console.error(`❌ Error extracting email from ${websiteUrl}:`, error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract email from multiple websites (batch processing)
 * @param {Array} businesses - Array of business objects with website property
 * @returns {Promise<Array>} Array of businesses with extracted emails
 */
async function extractEmailsFromWebsites(businesses) {
  const results = [];
  
  for (const business of businesses) {
    if (business.website) {
      try {
        const email = await extractEmailFromWebsite(business.website);
        results.push({
          ...business,
          email: email,
          emailExtractedAt: email ? new Date() : null
        });
        
        // Add delay between requests to avoid overwhelming servers
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error processing ${business.website}:`, error.message);
        results.push({
          ...business,
          email: null,
          emailExtractedAt: null
        });
      }
    } else {
      results.push({
        ...business,
        email: null,
        emailExtractedAt: null
      });
    }
  }
  
  return results;
}

module.exports = { extractEmailFromWebsite, extractEmailsFromWebsites };
