/**
 * Cookie Consent Handler Utility
 * Language-agnostic cookie consent popup handler that works across all languages and regions
 */

/**
 * Handle cookie consent popup (comprehensive, language-agnostic version)
 * @param {Page} page - Playwright page object
 * @param {Object} options - Options for cookie handling
 * @param {boolean} options.detailed - If true, uses all 3 strategies. If false, uses quick mode (default: true)
 * @returns {Promise<boolean>} True if cookie dialog was handled, false otherwise
 */
async function handleCookieConsent(page, options = { detailed: true }) {
  try {
    const detailed = options.detailed !== false;

    if (detailed) {
      console.log('🍪 Checking for cookie consent dialog...');
    }

    // Wait a bit for cookie dialog to appear
    await page.waitForTimeout(2000);

    let buttonClicked = false;

    // Strategy 1: Look for language-agnostic data attributes and patterns
    // These work regardless of the language
    const languageAgnosticSelectors = [
      // Google's consent form uses specific data attributes
      'button[jsname="b3VHJd"]', // Reject all button on Google (jsname attribute)
      'button[jsname="higCR"]',  // Accept all button on Google
      'form[action*="consent"] button[type="button"]:first-of-type', // First button (usually reject)
      'form[action*="consent"] button:first-child', // First button in consent form

      // Data attribute patterns
      'button[data-action="reject"]',
      'button[data-action="decline"]',
      'button[data-consent="reject"]',
      'button[data-consent="decline"]',
      'button[data-cookiefirst-action="reject"]',

      // Aria patterns (some are language-independent)
      'button[aria-label][jsname]', // Google buttons with jsname

      // Role and form-based selectors
      '[role="dialog"] form button:first-of-type',
      '[role="dialog"] button[type="button"]:first-of-type',
      '[role="alertdialog"] button:first-of-type',

      // Common patterns in consent dialogs
      'button[value="reject"]',
      'button[value="decline"]',
      'button[name="reject"]',
      'button[name="decline"]',

      // Class-based patterns (often language-independent)
      'button.reject-all',
      'button.decline-all',
      'button[class*="reject"]',
      'button[class*="decline"]'
    ];

    // Try language-agnostic selectors first
    for (const selector of languageAgnosticSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isVisible();
          if (isVisible) {
            const buttonText = await button.textContent().catch(() => 'Unknown');
            if (detailed) {
              console.log(`✅ Found cookie button (by attribute): "${buttonText?.trim()}" - clicking...`);
            }
            await button.click();
            await page.waitForTimeout(1500);
            buttonClicked = true;
            if (detailed) {
              console.log('✅ Cookie consent handled successfully');
            }
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Strategy 2: If not found, try to identify by button position in dialog
    if (!buttonClicked && detailed) {
      try {
        const buttonByPosition = await page.evaluate(() => {
          // Look for dialog/form containing buttons
          const dialogs = [
            ...document.querySelectorAll('[role="dialog"]'),
            ...document.querySelectorAll('[role="alertdialog"]'),
            ...document.querySelectorAll('form[action*="consent"]'),
            ...document.querySelectorAll('form[action*="cookie"]')
          ];

          for (const dialog of dialogs) {
            const buttons = dialog.querySelectorAll('button');
            if (buttons.length >= 2) {
              // In most consent dialogs, reject/decline is the first button
              // or the second button (after "more info")
              const firstButton = buttons[0];
              const secondButton = buttons[1];

              // Check if first button looks like a reject button (not "more info")
              const firstText = firstButton.textContent?.toLowerCase() || '';
              if (!firstText.includes('info') && !firstText.includes('more') &&
                  !firstText.includes('learn') && !firstText.includes('detail')) {
                return { found: true, index: 0 };
              }

              // Otherwise try second button
              if (secondButton) {
                return { found: true, index: 1 };
              }
            }
          }
          return { found: false };
        });

        if (buttonByPosition.found) {
          // Find the dialog again and click the identified button
          const dialogs = await page.$$('[role="dialog"], [role="alertdialog"], form[action*="consent"]');
          for (const dialog of dialogs) {
            const buttons = await dialog.$$('button');
            if (buttons[buttonByPosition.index]) {
              const buttonText = await buttons[buttonByPosition.index].textContent();
              console.log(`✅ Found cookie button (by position): "${buttonText?.trim()}" - clicking...`);
              await buttons[buttonByPosition.index].click();
              await page.waitForTimeout(1500);
              buttonClicked = true;
              console.log('✅ Cookie consent handled successfully');
              break;
            }
          }
        }
      } catch (e) {
        if (detailed) {
          console.log('⚠️  Position-based detection failed:', e.message);
        }
      }
    }

    // Strategy 3: Fallback to text-based detection (multiple languages)
    if (!buttonClicked && detailed) {
      const multilangTextPatterns = [
        // English
        'reject all', 'reject', 'decline all', 'decline',
        // Spanish
        'rechazar todo', 'rechazar', 'denegar',
        // French
        'tout refuser', 'refuser', 'rejeter',
        // German
        'alle ablehnen', 'ablehnen',
        // Italian
        'rifiuta tutto', 'rifiuta',
        // Portuguese
        'rejeitar tudo', 'rejeitar',
        // Dutch
        'alles afwijzen', 'afwijzen',
        // Polish
        'odrzuć wszystko', 'odrzuć',
        // Russian
        'отклонить все', 'отклонить',
        // Arabic (reject)
        'رفض', 'رفض الكل',
        // Chinese
        '拒绝', '全部拒绝',
        // Japanese
        'すべて拒否', '拒否',
        // Korean
        '모두 거부', '거부',
        // Hindi
        'अस्वीकार', 'सभी अस्वीकार',
        // Turkish
        'reddet', 'tümünü reddet',
        // Swedish
        'avvisa alla', 'avvisa',
        // Norwegian
        'avvis alle', 'avvis',
        // Danish
        'afvis alle', 'afvis',
        // Finnish
        'hylkää kaikki', 'hylkää'
      ];

      try {
        const buttons = await page.$$('button, a[role="button"]');
        for (const button of buttons) {
          const isVisible = await button.isVisible().catch(() => false);
          if (!isVisible) continue;

          const buttonText = (await button.textContent().catch(() => ''))?.toLowerCase().trim();

          // Check if button text matches any reject pattern
          if (multilangTextPatterns.some(pattern => buttonText.includes(pattern))) {
            console.log(`✅ Found cookie button (by text): "${buttonText}" - clicking...`);
            await button.click();
            await page.waitForTimeout(1500);
            buttonClicked = true;
            console.log('✅ Cookie consent handled successfully');
            break;
          }
        }
      } catch (e) {
        console.log('⚠️  Text-based detection failed:', e.message);
      }
    }

    if (!buttonClicked && detailed) {
      console.log('ℹ️  No cookie dialog found or already dismissed');
    }

    return buttonClicked;
  } catch (error) {
    console.log('⚠️  Error handling cookie consent (continuing anyway):', error.message);
    return false;
  }
}

/**
 * Handle cookie consent with quick mode (for repeated calls)
 * Uses only the fastest detection method (language-agnostic selectors)
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if cookie dialog was handled, false otherwise
 */
async function handleCookieConsentQuick(page) {
  return handleCookieConsent(page, { detailed: false });
}

module.exports = {
  handleCookieConsent,
  handleCookieConsentQuick
};
