const puppeteer = require('puppeteer');
const { extractBusinessDetails } = require('./utils/detailExtractor');
const { saveSingleBusinessToDB } = require('./utils/saveToDB');

/**
 * Get a random User-Agent string to avoid detection
 * @returns {string} Random User-Agent
 */
function getRandomUserAgent() {
  const userAgents = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    
    // Firefox on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    
    // Safari on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    
    // Chrome on Linux
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Get random viewport dimensions
 * @returns {Object} Viewport dimensions
 */
function getRandomViewport() {
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
  ];
  
  return viewports[Math.floor(Math.random() * viewports.length)];
}

/**
 * Set up browser fingerprinting avoidance
 * @param {Page} page - Puppeteer page object
 */
async function setupFingerprintAvoidance(page) {
  const userAgent = getRandomUserAgent();
  const viewport = getRandomViewport();
  
  // Set random User-Agent
  await page.setUserAgent(userAgent);
  
  // Set random viewport
  await page.setViewport(viewport);
  
  // Override navigator properties to avoid fingerprinting
  await page.evaluateOnNewDocument((ua, vp) => {
    // Override user agent
    Object.defineProperty(navigator, 'userAgent', {
      get: () => ua
    });
    
    // Override platform
    Object.defineProperty(navigator, 'platform', {
      get: () => {
        if (ua.includes('Windows')) return 'Win32';
        if (ua.includes('Mac')) return 'MacIntel';
        if (ua.includes('Linux')) return 'Linux x86_64';
        return 'Win32';
      }
    });
    
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
    
    // Override language
    Object.defineProperty(navigator, 'language', {
      get: () => 'en-US'
    });
    
    // Override webdriver flag
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    });
    
    // Override chrome object
    window.chrome = {
      runtime: {}
    };
    
    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
    
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
    
    // Override screen properties
    Object.defineProperty(screen, 'width', {
      get: () => vp.width
    });
    
    Object.defineProperty(screen, 'height', {
      get: () => vp.height
    });
    
    Object.defineProperty(screen, 'availWidth', {
      get: () => vp.width
    });
    
    Object.defineProperty(screen, 'availHeight', {
      get: () => vp.height - 40 // Account for taskbar
    });
    
    // Override timezone (randomize)
    const timezones = ['America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Asia/Karachi'];
    const randomTimezone = timezones[Math.floor(Math.random() * timezones.length)];
    Date.prototype.getTimezoneOffset = function() {
      const offsets = {
        'America/New_York': 300,
        'America/Los_Angeles': 480,
        'America/Chicago': 360,
        'Europe/London': 0,
        'Asia/Karachi': -300
      };
      return offsets[randomTimezone] || 0;
    };
    
    // Canvas fingerprint randomization
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const context = this.getContext('2d');
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] += Math.floor(Math.random() * 3) - 1;
        }
        context.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.apply(this, arguments);
    };
    
    // WebGL fingerprint randomization
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
        return 'Intel Inc.';
      }
      if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
        return 'Intel Iris OpenGL Engine';
      }
      return getParameter.apply(this, arguments);
    };
  }, userAgent, viewport);
  
  console.log(`Using User-Agent: ${userAgent.substring(0, 50)}...`);
  console.log(`Using Viewport: ${viewport.width}x${viewport.height}`);
}

/**
 * Scrapes Google Maps search results
 * @param {string} query - Search query (e.g., "dentist+in+lahore")
 * @param {Function} onBusinessExtracted - Callback function called after each business is extracted (optional)
 * @returns {Promise<Array>} Array of business information
 */
async function scrapeGoogleMaps(query, onBusinessExtracted = null) {
  let browser;
  
  try {
    // Launch browser
    // Set headless to false to debug: headless: false
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    
    // Set up fingerprinting avoidance (User-Agent rotation + browser fingerprinting)
    await setupFingerprintAvoidance(page);
    
    // Set additional headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    });

    // Construct Google Maps search URL
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    
    // Random delay before navigation (1-3 seconds) to appear more human-like
    const randomDelay = Math.floor(Math.random() * 2000) + 1000;
    await page.waitForTimeout(randomDelay);
    
    console.log(`Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for results to load
    await page.waitForSelector('[role="article"]', { timeout: 15000 }).catch(() => {
      console.log('Results selector not found, trying alternative selectors...');
    });

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(3000);

    // Check for and click "Show more" or pagination buttons
    try {
      const showMoreButton = await page.$('button[aria-label*="more"]') || 
                            await page.$('button:has-text("Show more")') ||
                            await page.$('[data-value="More results"]');
      if (showMoreButton) {
        console.log('Found "Show more" button, clicking...');
        await showMoreButton.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('No "Show more" button found or error clicking it');
    }

    // Scroll to load more results - improved method
    console.log('Scrolling to load more results...');
    let previousCount = 0;
    let currentCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 100; // Increased attempts
    let noChangeCount = 0;

    while (scrollAttempts < maxScrollAttempts) {
      // Get current count of results
      currentCount = await page.evaluate(() => {
        // Try multiple selectors
        const selectors = [
          '[role="article"]',
          '.Nv2PK',
          '.THOPZb',
          'a[href*="/maps/place/"]'
        ];
        
        let maxCount = 0;
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > maxCount) {
            maxCount = elements.length;
          }
        }
        return maxCount;
      });

      console.log(`Scroll attempt ${scrollAttempts + 1}: Found ${currentCount} results`);

      // If count hasn't increased after 2 attempts, we've reached the end
      if (currentCount === previousCount) {
        noChangeCount++;
        if (noChangeCount >= 2) {
          console.log(`No new results after ${noChangeCount} attempts. Stopping scroll. Total: ${currentCount}`);
          break;
        }
      } else {
        noChangeCount = 0; // Reset counter if we found new results
      }

      previousCount = currentCount;

      // Multiple scrolling strategies
      await page.evaluate(() => {
        // Strategy 1: Find and scroll the main results container
        const mainContainer = document.querySelector('[role="main"]') || 
                             document.querySelector('.m6QErb') ||
                             document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf') ||
                             document.querySelector('[aria-label*="Results"]');
        
        if (mainContainer) {
          // Scroll to bottom
          mainContainer.scrollTop = mainContainer.scrollHeight;
          // Also try scrolling by a large amount
          mainContainer.scrollBy(0, 1000);
        }

        // Strategy 2: Find all scrollable divs and scroll them
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          if (div.scrollHeight > div.clientHeight && div.scrollTop !== undefined) {
            const scrollableHeight = div.scrollHeight - div.clientHeight;
            if (scrollableHeight > 100) { // Only scroll if there's significant scrollable area
              div.scrollTop = div.scrollHeight;
              div.scrollBy(0, 500);
            }
          }
        }

        // Strategy 3: Use keyboard navigation to trigger loading
        // Focus on the results area
        const firstResult = document.querySelector('[role="article"]');
        if (firstResult) {
          firstResult.focus();
        }
      });

      // Strategy 4: Use keyboard to navigate down (triggers lazy loading)
      try {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);
      } catch (e) {
        // Ignore keyboard errors
      }

      // Strategy 5: Click on the last visible result to trigger loading
      try {
        await page.evaluate(() => {
          const results = document.querySelectorAll('[role="article"]');
          if (results.length > 0) {
            const lastResult = results[results.length - 1];
            // Scroll into view
            lastResult.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        });
      } catch (e) {
        // Ignore click errors
      }

      // Strategy 6: Hover over results to trigger lazy loading
      try {
        const results = await page.$$('[role="article"]');
        if (results.length > 0) {
          const lastIndex = Math.min(results.length - 1, scrollAttempts);
          if (lastIndex >= 0 && lastIndex < results.length) {
            await results[lastIndex].hover();
            await page.waitForTimeout(500);
          }
        }
      } catch (e) {
        // Ignore hover errors
      }

      // Wait for loading indicators to disappear
      try {
        await page.waitForFunction(() => {
          const loadingIndicators = document.querySelectorAll('[aria-busy="true"], .loading, [class*="loading"]');
          return loadingIndicators.length === 0;
        }, { timeout: 2000 }).catch(() => {
          // Continue even if loading indicator check times out
        });
      } catch (e) {
        // Ignore
      }

      // Wait for new content to load
      await page.waitForTimeout(1500);
      scrollAttempts++;
    }

    console.log(`Finished scrolling after ${scrollAttempts} attempts. Total results found: ${currentCount}`);

    // Final wait to ensure all content is loaded
    await page.waitForTimeout(2000);

    // Extract business information - improved extraction
    const results = await page.evaluate(() => {
      const businesses = [];
      
      // Try multiple selectors to find business cards - collect ALL matches
      const selectors = [
        '[role="article"]',
        '[data-value="Directions"]',
        '.Nv2PK',
        '.THOPZb',
        '[jsaction*="mouseover"]',
        'a[href*="/maps/place/"]'
      ];

      let businessElements = [];
      const seenElements = new Set();
      
      // Collect all unique elements from all selectors
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // Use a combination of text content and href to identify unique elements
          const identifier = el.textContent?.substring(0, 50) + (el.href || el.getAttribute('href') || '');
          if (!seenElements.has(identifier)) {
            seenElements.add(identifier);
            businessElements.push(el);
          }
        });
      }

      console.log(`Total unique business elements found: ${businessElements.length}`);

      businessElements.forEach((element, index) => {
        try {
          // Extract business name
          const nameElement = element.querySelector('[data-value="Directions"]')?.closest('[role="article"]')?.querySelector('div[aria-label]') ||
                             element.querySelector('div[aria-label]') ||
                             element.querySelector('h3') ||
                             element.querySelector('.qBF1Pd') ||
                             element.querySelector('.fontHeadlineSmall');
          
          const name = nameElement?.textContent?.trim() || 
                      element.getAttribute('aria-label')?.trim() ||
                      element.textContent?.trim() ||
                      `Business ${index + 1}`;

          // Extract rating
          const ratingElement = element.querySelector('[aria-label*="stars"]') ||
                               element.querySelector('[aria-label*="rating"]') ||
                               element.querySelector('.MW4etd');
          const ratingText = ratingElement?.getAttribute('aria-label') || 
                            ratingElement?.textContent || '';
          const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

          // Extract review count
          const reviewElement = element.querySelector('[aria-label*="reviews"]') ||
                               element.querySelector('.UY7F9');
          const reviewText = reviewElement?.getAttribute('aria-label') || 
                            reviewElement?.textContent || '';
          const reviewMatch = reviewText.match(/(\d+[\d,]*)/);
          const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : null;

          // Extract address
          const addressElement = element.querySelector('.W4Efsd:last-of-type') ||
                                element.querySelector('[data-value="Directions"]')?.parentElement?.querySelector('.W4Efsd') ||
                                element.querySelector('.fontBodyMedium');
          const address = addressElement?.textContent?.trim() || null;

          // Extract phone number
          const phoneElement = element.querySelector('[data-value="Phone"]') ||
                              element.querySelector('[aria-label*="phone"]');
          const phone = phoneElement?.getAttribute('aria-label')?.match(/\d[\d\s\-\(\)]+/)?.at(0) || null;

      // Extract website URL (exclude Google Maps links)
          const websiteElement = element.querySelector('[data-value="Website"]') ||
                                element.querySelector('a[href^="http"]');
          let website = websiteElement?.getAttribute('href') || null;
          
          // If website is a Google Maps link, set it to null
          if (website && (website.includes('google.com/maps') || website.includes('maps.google.com'))) {
            website = null;
          }

          // Extract place ID from URL
          const linkElement = element.querySelector('a[href*="/maps/place/"]') || element.closest('a[href*="/maps/place/"]');
          const placeUrl = linkElement?.getAttribute('href') || null;
          const placeIdMatch = placeUrl?.match(/\/place\/([^\/]+)/);
          const placeId = placeIdMatch ? placeIdMatch[1] : null;

          // Only add if we have at least a name
          if (name && name !== `Business ${index + 1}`) {
            businesses.push({
              name: name,
              rating: rating,
              reviewCount: reviewCount,
              address: address,
              phone: phone,
              website: website,
              placeId: placeId,
              placeUrl: placeUrl ? (placeUrl.startsWith('http') ? placeUrl : `https://www.google.com${placeUrl}`) : null
            });
          }
        } catch (error) {
          console.error(`Error extracting business ${index}:`, error);
        }
      });

      return businesses;
    });

    // Remove duplicates based on name
    const uniqueResults = results.filter((business, index, self) =>
      index === self.findIndex(b => b.name === business.name)
    );

    console.log(`Scraped ${uniqueResults.length} unique businesses from list`);
    
    // Now extract detailed information by clicking on each business
    console.log(`\n🔍 Starting detailed extraction for ${uniqueResults.length} businesses...`);
    const detailedResults = [];
    
    for (let i = 0; i < uniqueResults.length; i++) {
      const business = uniqueResults[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[${i + 1}/${uniqueResults.length}] Processing: ${business.name}`);
      console.log(`${'='.repeat(80)}`);
      
      try {
        // Extract detailed information
        const detailedBusiness = await extractBusinessDetails(page, business);
        detailedResults.push(detailedBusiness);
        
        // Call callback if provided (for saving to DB immediately after extraction)
        if (onBusinessExtracted) {
          await onBusinessExtracted(detailedBusiness, query);
        }
        
        // Add delay between businesses to avoid being blocked
        // Also ensure we're back to results list before next business
        await page.waitForTimeout(2000);
        
        // Verify we're back to results list before processing next business
        try {
          const isBackToList = await page.evaluate(() => {
            return document.querySelectorAll('[role="article"]').length > 0;
          });
          
          if (!isBackToList) {
            console.log(`⚠️  Not back to results list, waiting more...`);
            await page.waitForTimeout(2000);
          }
        } catch (e) {
          // Continue anyway
        }
        
      } catch (error) {
        console.error(`\n❌ Error processing ${business.name}:`, error.message);
        console.log('📋 Basic Business Data (Detail extraction failed):');
        console.log(`   Name:    ${business.name || 'N/A'}`);
        console.log(`   Rating:  ${business.rating || 'N/A'}`);
        console.log(`   Phone:   ${business.phone || 'N/A'}`);
        console.log(`   Website: ${business.website || 'N/A'}`);
        console.log(`   Address: ${business.address || 'N/A'}\n`);
        detailedResults.push(business); // Add original if detail extraction fails
        
        // Try to save even if detail extraction failed
        if (onBusinessExtracted) {
          await onBusinessExtracted(business, query);
        }
      }
    }

    console.log(`\n✅ Completed detailed extraction. Total: ${detailedResults.length} businesses`);
    
    // Return all results with detailed information
    return detailedResults;

  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeGoogleMaps };

