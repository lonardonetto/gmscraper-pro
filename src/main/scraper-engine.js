const { chromium } = require('playwright');
const log = require('electron-log');

let stopFlag = false;
let browserInstance = null;

function stop() {
  stopFlag = true;
  if (browserInstance) {
    browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildSearchUrl(keyword, location) {
  const query = encodeURIComponent(`${keyword} ${location}`);
  return `https://www.google.com/maps/search/${query}`;
}

const LISTING_SELECTOR = 'div[role="feed"] a[href*="/maps/place/"]';

async function scrapeListings(page, limit, onProgress, onLog, shouldContinue) {
  const results = [];
  const seen = new Set();

  onLog({ level: 'info', message: 'Scrolling to load results...' });

  // ── Step 1: scroll the feed until enough items are loaded ─────────────────
  let lastCount = 0;
  let noNewStreak = 0;

  while (shouldContinue()) {
    const count = await page.$$eval(LISTING_SELECTOR, els => els.length);
    if (count >= limit || noNewStreak >= 8) break;
    if (count === lastCount) { noNewStreak++; } else { noNewStreak = 0; lastCount = count; }
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) feed.scrollBy(0, 800);
    });
    await sleep(800);
  }

  // ── Step 2: collect all listing hrefs from the feed ───────────────────────
  const allHrefs = await page.$$eval(LISTING_SELECTOR, els =>
    els.map(el => el.getAttribute('href')).filter(Boolean)
  );

  // Deduplicate hrefs (Google sometimes renders same link twice)
  const uniqueHrefs = [...new Set(allHrefs)].slice(0, limit);
  onLog({ level: 'info', message: `Found ${allHrefs.length} listings (${uniqueHrefs.length} unique) — extracting ${uniqueHrefs.length}...` });

  // ── Step 3: visit each place URL directly ─────────────────────────────────
  for (let i = 0; i < uniqueHrefs.length; i++) {
    if (!shouldContinue()) {
      onLog({ level: 'warn', message: 'Scraping stopped by user' });
      break;
    }

    const placeUrl = uniqueHrefs[i];

    try {
      // Navigate directly to the place URL — no stale handle issues
      await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for the place name heading to appear
      try {
        await page.waitForSelector('h1.DUwDvf, h1[class*="fontHeadlineLarge"]', { timeout: 8000 });
      } catch {
        await sleep(2000);
      }

      // Extra wait for dynamic fields (phone, reviews)
      await sleep(700);

      const data = await page.evaluate(() => {
        const getText = (...sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.textContent.trim()) return el.textContent.trim();
          }
          return '';
        };
        const getHref = (...sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el && el.href) return el.href;
          }
          return '';
        };

        const name = getText(
          'h1.DUwDvf',
          'h1[class*="fontHeadlineLarge"]',
          '.DUwDvf'
        );

        const address = getText(
          'button[data-item-id="address"] .Io6YTe',
          '[data-tooltip="Copy address"] .Io6YTe',
          '[data-item-id="address"] .fontBodyMedium',
          '.rogA2c .Io6YTe'
        );

        const phone = getText(
          'button[data-item-id^="phone:tel"] .Io6YTe',
          'button[data-item-id^="phone"] .Io6YTe',
          '[data-tooltip="Copy phone number"] .Io6YTe',
          '[aria-label*="phone" i] .Io6YTe'
        );

        const website = getHref(
          'a[data-item-id="authority"]',
          'a[aria-label*="website" i]',
          'a[data-tooltip*="website" i]'
        );

        // Rating: the number like "4.5"
        const ratingEl =
          document.querySelector('div.F7nice > span[aria-hidden="true"]') ||
          document.querySelector('span.ceNzKf') ||
          document.querySelector('.MW4etd');
        const rating = ratingEl ? ratingEl.textContent.trim() : '';

        // Review count: find the (1,234) style span
        const reviewEl =
          document.querySelector('div.F7nice span[aria-label*="review"]') ||
          document.querySelector('button[aria-label*="review"] span') ||
          document.querySelector('span[aria-label*="review"]');
        const reviewRaw = reviewEl
          ? (reviewEl.getAttribute('aria-label') || reviewEl.textContent || '')
          : '';
        const reviewCount = reviewRaw.replace(/,/g, '').match(/\d+/)?.[0] || '';

        const category = getText('button.DkEaL', '.DkEaL');

        // Hours: open/closed status line
        const hours = getText(
          '.t39EBf .OqCZI',
          '.t39EBf',
          '[aria-label*="hour" i]'
        );

        return { name, address, phone, website, rating, reviewCount, category, hours };
      });

      if (!data.name) {
        onLog({ level: 'warn', message: `Item ${i + 1}: no name found at ${placeUrl.substring(0, 60)}` });
        continue;
      }

      // Deduplication by name + phone (or address fallback)
      const dedupKey = `${data.name}|${data.phone || data.address}`;
      if (seen.has(dedupKey)) {
        onLog({ level: 'warn', message: `Duplicate skipped: ${data.name}` });
        continue;
      }
      seen.add(dedupKey);

      results.push({
        name: data.name,
        address: data.address,
        phone: data.phone,
        website: data.website,
        rating: data.rating,
        reviewCount: data.reviewCount,
        category: data.category,
        hours: data.hours,
        scrapedAt: new Date().toISOString()
      });

      onProgress({
        current: results.length,
        total: uniqueHrefs.length,
        percent: Math.round((results.length / uniqueHrefs.length) * 100),
        latest: data.name
      });

      onLog({ level: 'success', message: `[${results.length}/${uniqueHrefs.length}] ${data.name}` });

      await sleep(400);

    } catch (err) {
      onLog({ level: 'warn', message: `Item ${i + 1} error: ${err.message.split('\n')[0]}` });
    }
  }

  return results;
}

async function run(config, onProgress, onLog, shouldContinue) {
  stopFlag = false;
  const {
    keyword,
    location,
    limit = 50,
    delay = 1000,
    proxy = null
  } = config;

  onLog({ level: 'info', message: `Starting scrape: "${keyword}" in "${location}"` });
  onLog({ level: 'info', message: `Target: ${limit} results` });

  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--lang=en-US'
    ]
  };

  if (proxy) {
    launchOptions.proxy = { server: proxy };
    onLog({ level: 'info', message: `Using proxy: ${proxy}` });
  }

  try {
    browserInstance = await chromium.launch(launchOptions);
    const context = await browserInstance.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-US'
    });

    const page = await context.newPage();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const url = buildSearchUrl(keyword, location);
    onLog({ level: 'info', message: `Navigating to: ${url}` });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for results feed to appear (Google Maps loads asynchronously)
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 20000 });
    } catch {
      onLog({ level: 'warn', message: 'Feed selector timed out — page may have loaded anyway, continuing...' });
    }
    await sleep(2000);

    // Handle various consent dialogs (region-dependent)
    const consentSelectors = [
      'button[aria-label="Accept all"]',
      'button[aria-label="Reject all"]',
      'form[action*="consent"] button',
      '#L2AGLb',
      '.tHlp8d'
    ];
    for (const sel of consentSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await sleep(1000);
        onLog({ level: 'info', message: `Dismissed consent dialog (${sel})` });
        break;
      }
    }

    await sleep(delay);

    const results = await scrapeListings(page, limit, onProgress, onLog, () => !stopFlag && shouldContinue());

    await browserInstance.close();
    browserInstance = null;

    onLog({ level: 'success', message: `Scraping complete! Extracted ${results.length} results` });
    return results;
  } catch (err) {
    if (browserInstance) {
      await browserInstance.close().catch(() => {});
      browserInstance = null;
    }
    log.error('Scraper error:', err);
    throw err;
  }
}

module.exports = { run, stop };
