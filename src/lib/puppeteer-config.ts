import puppeteer from 'puppeteer';

/**
 * Get Puppeteer launch options based on environment
 * In production (Vercel), we need special configuration for serverless
 */
export function getPuppeteerLaunchOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';

  if (isProduction || isVercel) {
    // Production/Vercel configuration
    return {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--single-process', // Important for serverless
      ],
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        '/usr/bin/google-chrome-stable' ||
        '/usr/bin/chromium-browser',
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
  const options = getPuppeteerLaunchOptions();
  return await puppeteer.launch(options);
}