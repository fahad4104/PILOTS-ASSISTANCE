import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';

/**
 * Get Puppeteer launch options based on environment
 * In production (Vercel), we need special configuration for serverless
 */
export async function getPuppeteerLaunchOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';

  if (isProduction || isVercel) {
    const chromiumPath =
      process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());

    // Production/Vercel configuration
    return {
      headless: chromium.headless,
      args: [
        ...chromium.args,
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--single-process', // Important for serverless
      ],
      executablePath: chromiumPath,
    };
  }

  // Development configuration (Windows/Local)
  return {
    headless: false, // Set to false to see the browser for debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  };
}

/**
 * Create a browser instance with proper configuration
 */
export async function createBrowser() {
  const options = await getPuppeteerLaunchOptions();
  return await puppeteer.launch(options);
}
