/**
 * Extract detailed information from a business detail page on Google Maps
 * @param {Page} page - Puppeteer page object
 * @param {Object} business - Basic business info from list
 * @returns {Promise<Object>} Enhanced business object with detailed info
 */
async function extractBusinessDetails(page, business) {
  try {
    console.log(`🔍 Extracting details for: ${business.name}`);
    
    // Store current URL to navigate back later
    const currentUrl = page.url();
    let navigatedAway = false;
    
    // Strategy: Use placeUrl to navigate directly to the business detail page
    // This is more reliable than clicking on cards
    if (business.placeUrl) {
      try {
        // Navigate to the business detail page
        await page.goto(business.placeUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 15000 
        });
        navigatedAway = true;
        
        // Wait for the detail page to load
        await page.waitForTimeout(3000);
        
        // Verify we're on the correct business page
        const isCorrectBusiness = await page.evaluate((expectedName) => {
          const pageTitle = document.querySelector('h1')?.textContent?.trim() ||
                           document.querySelector('[data-attrid="title"]')?.textContent?.trim() ||
                           document.querySelector('.x3AX1-LfntMc-header-title-title')?.textContent?.trim() ||
                           document.title;
          
          if (pageTitle) {
            const expectedLower = expectedName.substring(0, 20).toLowerCase();
            const foundLower = pageTitle.toLowerCase();
            return foundLower.includes(expectedLower) || expectedLower.includes(foundLower.substring(0, 20));
          }
          return false;
        }, business.name);
        
        if (!isCorrectBusiness) {
          console.log(`⚠️  Warning: Page title doesn't match expected business: ${business.name}`);
        }
      } catch (error) {
        console.log(`⚠️  Could not navigate to place URL: ${error.message}`);
        console.log(`   Returning original business data without detailed extraction`);
        return business; // Return original if navigation fails
      }
    } else {
      // If no placeUrl, return original business
      console.log(`⚠️  No placeUrl available for: ${business.name}`);
      return business;
    }
    
    // Wait for detail panel content to load (phone, website elements)
    try {
      // Wait for either phone or website button to appear (indicates panel loaded)
      await page.waitForSelector('[data-value="Phone"], [data-value="Website"], button[data-value="Phone"], a[href^="tel:"]', { 
        timeout: 3000 
      }).catch(() => {
        // Continue even if selectors not found
      });
    } catch (e) {
      // Ignore
    }
    
    // Additional wait to ensure all content is loaded
    await page.waitForTimeout(1000);

    // Extract detailed information from the detail panel
    // Also verify business name to ensure we're extracting from correct panel
    const detailedInfo = await page.evaluate((expectedBusinessName) => {
      const details = {
        phone: null,
        website: null,
        address: null,
        hours: null,
        category: null,
        description: null,
        additionalInfo: {},
        verifiedBusinessName: null
      };
      
      // First verify we're on the correct business
      const detailPanelName = document.querySelector('[role="main"] h1')?.textContent?.trim() ||
                             document.querySelector('.x3AX1-LfntMc-header-title-title')?.textContent?.trim() ||
                             document.querySelector('.qBF1Pd')?.textContent?.trim() ||
                             document.querySelector('.fontHeadlineSmall')?.textContent?.trim();
      
      details.verifiedBusinessName = detailPanelName;
      
      // If business name doesn't match, return early (but still try to extract)
      // This helps identify if we're extracting wrong data

      // First, double-check we're on the correct business by verifying name
      const currentPanelName = document.querySelector('[role="main"] h1')?.textContent?.trim() ||
                               document.querySelector('.x3AX1-LfntMc-header-title-title')?.textContent?.trim() ||
                               document.querySelector('.qBF1Pd')?.textContent?.trim() ||
                               document.querySelector('.fontHeadlineSmall')?.textContent?.trim();
      
      // Only extract if business name matches (to avoid extracting wrong business data)
      if (!currentPanelName || !currentPanelName.toLowerCase().includes(expectedBusinessName.substring(0, 20).toLowerCase())) {
        console.warn(`⚠️  Panel name mismatch! Expected: ${expectedBusinessName}, Found: ${currentPanelName}`);
        // Still try to extract, but log warning
      }
      
      // Extract phone number - improved to avoid parent company numbers
      // Strategy 1: Look for Phone button in main business info section (most reliable)
      const phoneButton = document.querySelector('a[data-value="Phone"]') ||
                         document.querySelector('button[data-value="Phone"]') ||
                         document.querySelector('[data-value="Phone"]');
      
      if (phoneButton) {
        let phoneText = phoneButton.getAttribute('aria-label') || 
                       phoneButton.textContent || 
                       phoneButton.getAttribute('href') ||
                       phoneButton.closest('a')?.getAttribute('href') ||
                       phoneButton.getAttribute('title');
        
        if (phoneText) {
          if (phoneText.startsWith('tel:')) {
            phoneText = phoneText.replace('tel:', '').trim();
          }
          const phoneMatch = phoneText.match(/[\d\s\+\-\(\)]{7,}/);
          if (phoneMatch) {
            details.phone = phoneMatch[0].trim();
          }
        }
      }
      
      // Strategy 2: Look in main business info section (Io6YTe elements) - more specific
      if (!details.phone) {
        const mainInfoSection = document.querySelector('[role="main"]') ||
                               document.querySelector('.m6QErb');
        
        if (mainInfoSection) {
          // Look for phone in contact info elements within main section
          const contactElements = mainInfoSection.querySelectorAll('.Io6YTe.fontBodyMedium');
          for (const element of contactElements) {
            const text = element.textContent || element.getAttribute('aria-label') || '';
            const link = element.querySelector('a[href^="tel:"]');
            
            // Check if this element contains phone-related text
            if (text.toLowerCase().includes('phone') || 
                text.toLowerCase().includes('call') ||
                link) {
              
              let phoneText = link ? link.getAttribute('href') : text;
              if (phoneText) {
                if (phoneText.startsWith('tel:')) {
                  phoneText = phoneText.replace('tel:', '').trim();
                }
                const phoneMatch = phoneText.match(/[\d\s\+\-\(\)]{7,}/);
                if (phoneMatch) {
                  const phone = phoneMatch[0].trim();
                  const digitsOnly = phone.replace(/\D/g, '');
                  // Validate phone length
                  if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
                    details.phone = phone;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      // Strategy 3: Look for tel: links specifically in the main panel
      if (!details.phone) {
        const mainPanel = document.querySelector('[role="main"]') ||
                         document.querySelector('.m6QErb');
        
        if (mainPanel) {
          const telLinks = mainPanel.querySelectorAll('a[href^="tel:"]');
          for (const link of telLinks) {
            const href = link.getAttribute('href');
            if (href) {
              const phone = href.replace('tel:', '').trim();
              const digitsOnly = phone.replace(/\D/g, '');
              if (phone.length >= 7 && digitsOnly.length >= 7 && digitsOnly.length <= 15) {
                details.phone = phone;
                break;
              }
            }
          }
        }
      }
      
      // Strategy 4: Last resort - search in main panel text (avoid sidebar)
      if (!details.phone) {
        const mainPanel = document.querySelector('[role="main"]') ||
                         document.querySelector('.m6QErb');
        
        if (mainPanel) {
          const panelText = mainPanel.innerText || mainPanel.textContent || '';
          const phonePatterns = [
            /\+?[\d\s\-\(\)]{10,}/g,
            /\+?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,9}/g
          ];
          
          for (const pattern of phonePatterns) {
            const matches = panelText.match(pattern);
            if (matches && matches.length > 0) {
              const validPhone = matches.find(match => {
                const digitsOnly = match.replace(/\D/g, '');
                return digitsOnly.length >= 7 && digitsOnly.length <= 15;
              });
              
              if (validPhone) {
                details.phone = validPhone.trim();
                break;
              }
            }
          }
        }
      }

      // Extract website (exclude Google Maps links) - improved extraction
      // Strategy 1: Look for the specific "Website" button/link in the main info section
      const websiteButton = document.querySelector('a[data-value="Website"]') ||
                           document.querySelector('button[data-value="Website"]') ||
                           document.querySelector('[data-value="Website"]');
      
      if (websiteButton) {
        const href = websiteButton.getAttribute('href') || 
                     websiteButton.closest('a')?.getAttribute('href');
        if (href && 
            href.startsWith('http') && 
            !href.includes('google.com/maps') && 
            !href.includes('maps.google.com') &&
            !href.includes('google.com/search')) {
          details.website = href;
        }
      }
      
      // Strategy 2: Look in the main business info section (not in ads or related businesses)
      if (!details.website) {
        // Find the main business info container
        const mainInfoSection = document.querySelector('[role="main"]') ||
                               document.querySelector('.m6QErb') ||
                               document.querySelector('.x3AX1-LfntMc-header-title-title');
        
        if (mainInfoSection) {
          // Look for website links only within the main info section
          const linksInMainSection = mainInfoSection.querySelectorAll('a[href^="http"]');
          for (const link of linksInMainSection) {
            const href = link.getAttribute('href');
            const ariaLabel = link.getAttribute('aria-label')?.toLowerCase() || '';
            const text = link.textContent?.toLowerCase() || '';
            
            // Check if it's explicitly marked as website
            if (href && 
                href.startsWith('http') &&
                !href.includes('google.com') &&
                !href.includes('maps.google.com') &&
                !href.includes('youtube.com') &&
                !href.includes('facebook.com') &&
                !href.includes('instagram.com') &&
                !href.includes('twitter.com') &&
                !href.includes('linkedin.com') &&
                (ariaLabel.includes('website') || 
                 ariaLabel.includes('visit website') ||
                 text.includes('website') ||
                 link.closest('[data-value="Website"]'))) {
              details.website = href;
              break;
            }
          }
        }
      }
      
      // Strategy 3: Look for website in the contact info section (Io6YTe elements)
      if (!details.website) {
        const contactInfoElements = document.querySelectorAll('.Io6YTe.fontBodyMedium');
        for (const element of contactInfoElements) {
          const link = element.querySelector('a[href^="http"]');
          if (link) {
            const href = link.getAttribute('href');
            const parentText = element.textContent?.toLowerCase() || '';
            
            // Only take if it's in a contact info context (not in ads)
            if (href && 
                href.startsWith('http') &&
                !href.includes('google.com') &&
                !href.includes('maps.google.com') &&
                !href.includes('youtube.com') &&
                !href.includes('facebook.com') &&
                !href.includes('instagram.com') &&
                !href.includes('twitter.com') &&
                !href.includes('linkedin.com') &&
                (parentText.includes('website') || 
                 parentText.includes('www.') ||
                 element.previousElementSibling?.textContent?.toLowerCase().includes('website'))) {
              details.website = href;
              break;
            }
          }
        }
      }
      
      // Strategy 4: Last resort - find any external link but exclude social media and common domains
      if (!details.website) {
        const allLinks = document.querySelectorAll('a[href^="http"]');
        const excludedDomains = [
          'google.com', 'maps.google.com', 'youtube.com', 'facebook.com',
          'instagram.com', 'twitter.com', 'linkedin.com', 'pinterest.com',
          'tumblr.com', 'reddit.com', 'github.com', 'stackoverflow.com'
        ];
        
        for (const link of allLinks) {
          const href = link.getAttribute('href');
          if (href && href.startsWith('http')) {
            const url = new URL(href);
            const domain = url.hostname.toLowerCase();
            
            // Skip if it's an excluded domain
            if (excludedDomains.some(excluded => domain.includes(excluded))) {
              continue;
            }
            
            // Check if it's in the main business panel (not in sidebar ads)
            const isInMainPanel = link.closest('[role="main"]') || 
                                 link.closest('.m6QErb') ||
                                 link.closest('[data-value="Website"]');
            
            if (isInMainPanel && href.match(/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)) {
              details.website = href;
              break;
            }
          }
        }
      }
      
      // Final validation - ensure it's not a Google Maps link or invalid
      if (details.website && 
          (details.website.includes('google.com/maps') || 
           details.website.includes('maps.google.com') ||
           details.website.includes('google.com/search'))) {
        details.website = null;
      }

      // Extract address (more detailed)
      const addressSelectors = [
        '[data-value="Directions"]',
        'button[data-value="Directions"]',
        '.Io6YTe',
        '.fontBodyMedium',
        '[aria-label*="Address"]'
      ];
      
      for (const selector of addressSelectors) {
        const addressElement = document.querySelector(selector);
        if (addressElement) {
          const addressText = addressElement.textContent || 
                             addressElement.getAttribute('aria-label');
          if (addressText && addressText.length > 10) {
            details.address = addressText.trim();
            break;
          }
        }
      }

      // Extract business hours
      const hoursElement = document.querySelector('[aria-label*="hours"]') ||
                          document.querySelector('[aria-label*="Hours"]') ||
                          document.querySelector('.t39EBf');
      if (hoursElement) {
        details.hours = hoursElement.textContent?.trim() || 
                       hoursElement.getAttribute('aria-label');
      }

      // Extract category
      const categoryElement = document.querySelector('.DkEaL') ||
                            document.querySelector('[jsaction*="category"]');
      if (categoryElement) {
        details.category = categoryElement.textContent?.trim();
      }

      return details;
    }, business.name);
    
    // Verify we extracted from the correct business
    if (detailedInfo.verifiedBusinessName && 
        !detailedInfo.verifiedBusinessName.toLowerCase().includes(business.name.substring(0, 20).toLowerCase())) {
      console.log(`⚠️  Warning: Extracted data might be from different business!`);
      console.log(`   Expected: ${business.name}`);
      console.log(`   Found in panel: ${detailedInfo.verifiedBusinessName}`);
    }

    // Merge detailed info with original business info
    // Smart website selection: avoid parent company websites
    let finalWebsite = null;
    
    // Check if detail page website seems like a parent company website
    // (if it's different from original and original exists, prefer original if it seems more specific)
    const detailWebsite = detailedInfo.website && 
                         !detailedInfo.website.includes('google.com/maps') && 
                         !detailedInfo.website.includes('maps.google.com') 
                         ? detailedInfo.website : null;
    
    const originalWebsite = business.website && 
                            !business.website.includes('google.com/maps') && 
                            !business.website.includes('maps.google.com')
                            ? business.website : null;
    
    // Decision logic:
    // 1. If both exist and are different, prefer the one that seems more specific to this business
    // 2. If detail page has website and original doesn't, use detail page
    // 3. If original has website and detail page doesn't, use original
    // 4. If detail page website looks like a generic/parent company site, prefer original
    
    if (detailWebsite && originalWebsite) {
      // Both exist - check if detail website seems like a parent company
      // (e.g., if it's a common domain appearing for multiple businesses)
      // For now, prefer detail page if it exists, but we can improve this
      finalWebsite = detailWebsite;
    } else if (detailWebsite) {
      finalWebsite = detailWebsite;
    } else if (originalWebsite) {
      finalWebsite = originalWebsite;
    }
    
    // Final check - ensure no Google Maps links
    if (finalWebsite && (finalWebsite.includes('google.com/maps') || finalWebsite.includes('maps.google.com'))) {
      finalWebsite = null;
    }
    
    // Smart phone selection: prefer detail page phone, but use original if detail seems wrong
    let finalPhone = null;
    
    const detailPhone = detailedInfo.phone;
    const originalPhone = business.phone;
    
    // If both exist and are different, prefer detail page phone (more reliable)
    // But if detail phone seems like a parent company number (same for multiple businesses),
    // we might want to prefer original. For now, prefer detail page.
    if (detailPhone) {
      finalPhone = detailPhone;
    } else if (originalPhone) {
      finalPhone = originalPhone;
    }
    
    const enhancedBusiness = {
      ...business,
      phone: finalPhone,
      website: finalWebsite,
      address: detailedInfo.address || business.address,
      hours: detailedInfo.hours,
      category: detailedInfo.category,
      description: detailedInfo.description
    };

    // Print complete business data in console
    console.log(`\n✅ Details extracted for: ${business.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Complete Business Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Name:        ${enhancedBusiness.name || 'N/A'}`);
    console.log(`   Rating:      ${enhancedBusiness.rating ? `${enhancedBusiness.rating} ⭐` : 'N/A'}`);
    console.log(`   Reviews:     ${enhancedBusiness.reviewCount ? `${enhancedBusiness.reviewCount}` : 'N/A'}`);
    console.log(`   Phone:       ${enhancedBusiness.phone || 'N/A'}`);
    console.log(`   Website:     ${enhancedBusiness.website || 'N/A'}`);
    if (enhancedBusiness.website) {
      console.log(`   📍 Website Source: ${detailedInfo.website ? 'Detail Page' : 'List View'}`);
    }
    console.log(`   Address:     ${enhancedBusiness.address || 'N/A'}`);
    console.log(`   Hours:       ${enhancedBusiness.hours || 'N/A'}`);
    console.log(`   Category:    ${enhancedBusiness.category || 'N/A'}`);
    console.log(`   Place ID:    ${enhancedBusiness.placeId || 'N/A'}`);
    console.log(`   Place URL:   ${enhancedBusiness.placeUrl || 'N/A'}`);
    console.log(`   Email:       ${enhancedBusiness.email || 'N/A (Use /api/extract-email to extract)'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   🔍 Debug Info:`);
    console.log(`      - Detail Page Website: ${detailedInfo.website || 'Not found'}`);
    console.log(`      - Original Website: ${business.website || 'Not found'}`);
    console.log(`      - Final Website: ${finalWebsite || 'Not found'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Go back to results list
    if (navigatedAway && currentUrl) {
      try {
        // Navigate back to the original search results page
        await page.goto(currentUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 15000 
        });
        await page.waitForTimeout(2000);
        
        // Verify we're back to results list
        const isBackToList = await page.evaluate(() => {
          return document.querySelectorAll('[role="article"]').length > 0;
        });
        
        if (!isBackToList) {
          console.log(`⚠️  Warning: May not be back to results list for ${business.name}`);
        }
      } catch (e) {
        console.log(`⚠️  Warning: Could not navigate back to results list: ${e.message}`);
      }
    } else {
      // If we used click method, just close the panel
      try {
        await page.keyboard.press('Escape'); // Close detail panel
        await page.waitForTimeout(1500); // Wait for panel to close
        
        // Verify panel is closed by checking if results list is visible
        await page.evaluate(() => {
          const resultsList = document.querySelector('[role="article"]');
          if (!resultsList) {
            // If no results visible, might need to scroll or wait more
            return false;
          }
          return true;
        });
      } catch (e) {
        console.log(`⚠️  Warning: Could not verify panel closure for ${business.name}`);
      }
    }

    return enhancedBusiness;

  } catch (error) {
    console.error(`❌ Error extracting details for ${business.name}:`, error.message);
    
    // Try to go back if we navigated away
    try {
      const currentUrl = page.url();
      // If we're not on a search results page, try to go back
      if (!currentUrl.includes('/maps/search/')) {
        // Try browser back button
        await page.goBack({ waitUntil: 'networkidle2', timeout: 10000 });
        await page.waitForTimeout(2000);
      } else {
        // If on search page, just press escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // Ignore
    }
    
    return business; // Return original business on error
  }
}

module.exports = { extractBusinessDetails };

