import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Configure chromium for serverless
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

/**
 * Get Puppeteer launch options based on environment
 * In production (Vercel), we need special configuration for serverless
 */
export async function getPuppeteerLaunchOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1';

  if (isProduction || isVercel) {
    const chromiumPath = await chromium.executablePath();

    console.log('Chromium path:', chromiumPath);

    // Production/Vercel configuration
    return {
      headless: chromium.headless,
      args: [
        ...chromium.args,
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--single-process',
        '--no-zygote',
      ],
      executablePath: chromiumPath,
      defaultViewport: { width: 1920, height: 1080 },
    };
  }

  // Development configuration (Windows/Local)
  // For puppeteer-core, we need to specify the Chrome path
  const localChromePath = process.env.CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  return {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    executablePath: localChromePath,
  };
}

/**
 * Create a browser instance with proper configuration
 */
export async function createBrowser() {
  const options = await getPuppeteerLaunchOptions();
  return await puppeteer.launch(options);
}
