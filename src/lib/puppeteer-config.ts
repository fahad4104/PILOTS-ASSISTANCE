import puppeteer from 'puppeteer-core';

/**
 * Create a browser instance
 * - Production (Vercel): Connect to Browserless.io remote browser
 * - Development: Launch local Chrome
 */
export async function createBrowser() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';

  if (isProduction || isVercel) {
    // Use Browserless.io in production
    const browserlessApiKey = process.env.BROWSERLESS_API_KEY;

    if (!browserlessApiKey) {
      throw new Error('BROWSERLESS_API_KEY environment variable is not set');
    }

    console.log('Connecting to Browserless.io...');

    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessApiKey}`,
    });

    console.log('Connected to Browserless.io');
    return browser;
  }

  // Development: Launch local Chrome
  const localChromePath = process.env.CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  console.log('Launching local Chrome...');

  return await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    executablePath: localChromePath,
  });
}
