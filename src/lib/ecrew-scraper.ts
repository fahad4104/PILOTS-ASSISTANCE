import { Browser, Page } from 'puppeteer-core';
import { createBrowser } from './puppeteer-config';

export interface EcrewFlight {
  date: string;
  flightNumber: string;
  departure: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  aircraft: string;
  coPilot?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface EcrewCredentials {
  employeeId: string;
  password: string;
}

export class EcrewScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    try {
      this.browser = await createBrowser();
      this.page = await this.browser.newPage();

      // Set a realistic viewport and user agent
      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      // Set timeout for navigation
      this.page.setDefaultNavigationTimeout(60000);
      this.page.setDefaultTimeout(30000);
    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async login(credentials: EcrewCredentials): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      console.log('Navigating to eCrew login page...');
      await this.page.goto('https://ecrew.etihad.ae/ecrew', {
        waitUntil: 'networkidle2',
      });

      // Wait for page to load - eCrew uses Webix framework
      await this.page.waitForSelector('input[name="hhjemjlmjyis"], .crewid input, input[placeholder="Crew ID"]', {
        timeout: 20000,
      });

      console.log('Filling in credentials...');

      // Try to find the Employee ID/Crew ID field (eCrew specific selectors)
      const employeeIdSelectors = [
        'input[name="hhjemjlmjyis"]',  // eCrew Crew ID field (Webix)
        '.crewid input',               // eCrew CSS class
        'input[placeholder="Crew ID"]', // eCrew placeholder
        'input[type="text"].crewid',
        'input[name="username"]',
        'input[id="username"]',
        'input[type="text"]',
      ];

      let employeeIdFieldFound = false;
      for (const selector of employeeIdSelectors) {
        try {
          const field = await this.page.$(selector);
          if (field) {
            await this.page.type(selector, credentials.employeeId, { delay: 50 });
            employeeIdFieldFound = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!employeeIdFieldFound) {
        throw new Error('Could not find Employee ID/Crew ID input field');
      }

      // Try to find the password field (eCrew specific)
      const passwordSelectors = [
        'input[name="glsebouqswjdvtms"]',  // eCrew password field (Webix)
        '.password input',                  // eCrew CSS class
        'input[type="password"]',
        'input[name="password"]',
        'input[id="password"]',
      ];

      let passwordFieldFound = false;
      for (const selector of passwordSelectors) {
        try {
          const field = await this.page.$(selector);
          if (field) {
            await this.page.type(selector, credentials.password, { delay: 50 });
            passwordFieldFound = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!passwordFieldFound) {
        throw new Error('Could not find password input field');
      }

      console.log('Submitting login form...');

      // Try to find and click the submit button (eCrew specific)
      const submitSelectors = [
        'button[id="loginbtn"]',           // eCrew login button ID
        '.webix_primary button',           // eCrew button class
        'button:has-text("Log in")',       // eCrew button text
        'button[type="submit"]',
        'input[type="submit"]',
        'button[id="login"]',
        'button[name="login"]',
      ];

      let submitButtonFound = false;
      for (const selector of submitSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await Promise.all([
              this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
              this.page.click(selector),
            ]);
            submitButtonFound = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!submitButtonFound) {
        // Try pressing Enter as fallback
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          this.page.keyboard.press('Enter'),
        ]);
      }

      // Check if login was successful by looking for error messages or checking URL
      const currentUrl = this.page.url();
      console.log('Current URL after login:', currentUrl);

      // Look for common error indicators
      const errorSelectors = [
        '.error',
        '.alert-danger',
        '[class*="error"]',
        '[id*="error"]',
      ];

      for (const selector of errorSelectors) {
        const errorElement = await this.page.$(selector);
        if (errorElement) {
          const errorText = await this.page.evaluate(el => el.textContent, errorElement);
          throw new Error(`Login failed: ${errorText}`);
        }
      }

      console.log('Login successful!');
      return true;
    } catch (error) {
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async navigateToSchedule(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    try {
      console.log('Navigating to My Schedule page...');

      // Try to find and click on "My Schedule" or "Roster" link
      const scheduleSelectors = [
        'a[href*="schedule"]',
        'a[href*="roster"]',
        'a:has-text("My Schedule")',
        'a:has-text("Schedule")',
        'a:has-text("Roster")',
      ];

      let scheduleFound = false;
      for (const selector of scheduleSelectors) {
        try {
          const link = await this.page.$(selector);
          if (link) {
            await Promise.all([
              this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
              this.page.click(selector),
            ]);
            scheduleFound = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!scheduleFound) {
        // If we can't find a link, try common schedule URLs
        const possibleUrls = [
          'https://ecrew.etihad.ae/ecrew/schedule',
          'https://ecrew.etihad.ae/ecrew/my-schedule',
          'https://ecrew.etihad.ae/ecrew/roster',
        ];

        for (const url of possibleUrls) {
          try {
            await this.page.goto(url, { waitUntil: 'networkidle2' });
            scheduleFound = true;
            break;
          } catch (e) {
            continue;
          }
        }
      }

      if (!scheduleFound) {
        throw new Error('Could not navigate to schedule page');
      }

      console.log('Successfully navigated to schedule page');
    } catch (error) {
      throw new Error(`Failed to navigate to schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractFlights(): Promise<EcrewFlight[]> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    try {
      console.log('Extracting flight data...');

      // Wait for the schedule table to load
      await this.page.waitForSelector('table, .schedule-table, [class*="schedule"]', {
        timeout: 10000,
      });

      // Extract flight data from the page
      const flights = await this.page.evaluate(() => {
        const flightData: EcrewFlight[] = [];

        // Try to find the schedule table
        const tables = document.querySelectorAll('table');

        for (const table of tables) {
          const rows = table.querySelectorAll('tbody tr, tr');

          for (const row of rows) {
            const cells = row.querySelectorAll('td, th');
            if (cells.length < 5) continue; // Skip rows with too few cells

            try {
              // This is a generic extraction - you'll need to adjust based on actual eCrew table structure
              const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');

              // Try to identify flight data patterns
              // Adjust these indices based on actual eCrew table structure
              const flight: EcrewFlight = {
                date: cellTexts[0] || '',
                flightNumber: cellTexts[1] || '',
                departure: cellTexts[2] || '',
                destination: cellTexts[3] || '',
                departureTime: cellTexts[4] || '',
                arrivalTime: cellTexts[5] || '',
                aircraft: cellTexts[6] || '',
                coPilot: cellTexts[7] || undefined,
                status: 'scheduled' as const,
              };

              // Only add if we have essential data
              if (flight.date && flight.flightNumber) {
                flightData.push(flight);
              }
            } catch (e) {
              console.error('Error parsing row:', e);
            }
          }
        }

        return flightData;
      });

      console.log(`Extracted ${flights.length} flights`);
      return flights;
    } catch (error) {
      throw new Error(`Failed to extract flights: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async takeScreenshot(path: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }
    await this.page.screenshot({ path, fullPage: true });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

// Main function to scrape eCrew schedule
export async function scrapeEcrewSchedule(
  credentials: EcrewCredentials
): Promise<EcrewFlight[]> {
  const scraper = new EcrewScraper();

  try {
    await scraper.initialize();
    await scraper.login(credentials);
    await scraper.navigateToSchedule();
    const flights = await scraper.extractFlights();
    return flights;
  } finally {
    await scraper.close();
  }
}