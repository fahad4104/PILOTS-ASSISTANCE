import { Browser, Page } from 'puppeteer';
import { createBrowser } from './puppeteer-config';
import { createHash } from 'crypto';

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

export class EcrewScraperWebix {
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
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      console.log('Page loaded, waiting for login form...');

      // Wait for the Crew ID input field to appear
      await this.page.waitForSelector('input[placeholder="Crew ID"]', {
        timeout: 30000,
      });

      console.log('Login form found, waiting for page to stabilize...');

      // Wait a bit more for the form to be fully ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('Filling in credentials using Webix API...');

      // Use direct input field manipulation since Webix IDs are dynamic
      const loginResult = await this.page.evaluate(
        (crewId, plainPassword) => {
          try {
            // Find Crew ID input by placeholder (from eCrew HTML structure)
            const crewIdInput = document.querySelector('input[placeholder="Crew ID"]') as HTMLInputElement;

            // Find password input - look for password type input in the form
            const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

            if (!crewIdInput) {
              return { success: false, error: 'Crew ID field not found' };
            }

            if (!passwordInput) {
              return { success: false, error: 'Password field not found' };
            }

            // Set Crew ID value
            crewIdInput.focus();
            crewIdInput.value = crewId;
            crewIdInput.dispatchEvent(new Event('input', { bubbles: true }));
            crewIdInput.dispatchEvent(new Event('change', { bubbles: true }));

            // Set password value
            passwordInput.focus();
            passwordInput.value = plainPassword;
            passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
            passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

            // Find and click login button using view_id="loginbtn"
            setTimeout(() => {
              const loginButton = document.querySelector('[view_id="loginbtn"] button, .webix_el_button.webix_primary button') as HTMLButtonElement;
              if (loginButton) {
                loginButton.click();
              } else {
                // Fallback: find any button with "Log in" text
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                  if (btn.textContent?.toLowerCase().includes('log in')) {
                    btn.click();
                    break;
                  }
                }
              }
            }, 100);

            return { success: true, method: 'Direct input manipulation' };
          } catch (err: any) {
            return { success: false, error: err.message };
          }
        },
        credentials.employeeId,
        credentials.password
      );

      if (!loginResult.success) {
        throw new Error(`Webix login failed: ${loginResult.error}`);
      }

      console.log('Login form submitted, waiting for response...');

      // Wait for navigation or error message
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Check for error messages
      const errorMessage = await this.page.evaluate(() => {
        // Look for error messages in Webix notifications
        const notifications = document.querySelectorAll('.webix_message_area .webix_error, .webix_message_area [class*="error"]');
        if (notifications.length > 0) {
          return notifications[0].textContent?.trim() || null;
        }

        // Check for general error indicators
        const errorText = document.body.innerText;
        if (errorText.includes('Invalid Credentials') ||
            errorText.includes('Login failed') ||
            errorText.includes('Authentication failed')) {
          return 'Invalid credentials';
        }

        return null;
      });

      if (errorMessage) {
        throw new Error(`Login failed: ${errorMessage}`);
      }

      // Check if we're redirected to dashboard
      const currentUrl = this.page.url();
      console.log('Current URL after login:', currentUrl);

      if (currentUrl.includes('/Dashboard') || currentUrl.includes('/dashboard')) {
        console.log('Login successful!');
        return true;
      }

      // If we're still on the login page after 5 seconds, assume failure
      if (currentUrl.includes('/ecrew') && !currentUrl.includes('Dashboard')) {
        throw new Error('Login may have failed - still on login page');
      }

      console.log('Login appears successful!');
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

      // Wait for page to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to find and click on "My Schedule" or "Roster" menu item
      const scheduleClicked = await this.page.evaluate(() => {
        try {
          // Look for schedule/roster links in the navigation
          const links = Array.from(document.querySelectorAll('a, span, div'));
          const scheduleLink = links.find(el => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('schedule') ||
                   text.includes('roster') ||
                   text.includes('my schedule');
          });

          if (scheduleLink) {
            (scheduleLink as HTMLElement).click();
            return true;
          }
          return false;
        } catch (err) {
          return false;
        }
      });

      if (scheduleClicked) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('Clicked on schedule menu item');
      } else {
        // Try direct URL navigation
        const possibleUrls = [
          'https://ecrew.etihad.ae/ecrew/schedule',
          'https://ecrew.etihad.ae/ecrew/roster',
          'https://ecrew.etihad.ae/ecrew/my-schedule',
        ];

        for (const url of possibleUrls) {
          try {
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            console.log(`Successfully navigated to ${url}`);
            break;
          } catch (e) {
            continue;
          }
        }
      }

      console.log('Successfully on schedule page');
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

      // Wait for schedule data to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Take a screenshot for debugging
      try {
        await this.page.screenshot({ path: '/tmp/ecrew-schedule.png', fullPage: true });
        console.log('Screenshot saved: /tmp/ecrew-schedule.png');
      } catch (screenshotError) {
        console.log('Could not save screenshot');
      }

      // Extract flight data
      const flights = await this.page.evaluate(() => {
        const flightData: any[] = [];

        // Try to find Webix datatable or grid
        if (typeof $$ !== 'undefined') {
          // Look for Webix datatables
          const datatables = document.querySelectorAll('[view_id]');
          for (const table of datatables) {
            try {
              const viewId = table.getAttribute('view_id');
              if (viewId) {
                const webixTable = $$(viewId);
                if (webixTable && typeof webixTable.data !== 'undefined') {
                  const data = webixTable.data.serialize();
                  if (data && data.length > 0) {
                    flightData.push(...data);
                  }
                }
              }
            } catch (e) {
              continue;
            }
          }
        }

        // If no Webix data, try HTML tables
        if (flightData.length === 0) {
          const tables = document.querySelectorAll('table');
          for (const table of tables) {
            const rows = table.querySelectorAll('tbody tr, tr');
            for (const row of rows) {
              const cells = row.querySelectorAll('td, th');
              if (cells.length >= 5) {
                const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
                if (cellTexts[0] && cellTexts[1]) {
                  flightData.push({
                    date: cellTexts[0],
                    flightNumber: cellTexts[1],
                    departure: cellTexts[2] || '',
                    destination: cellTexts[3] || '',
                    departureTime: cellTexts[4] || '',
                    arrivalTime: cellTexts[5] || '',
                    aircraft: cellTexts[6] || '',
                    coPilot: cellTexts[7] || undefined,
                  });
                }
              }
            }
          }
        }

        return flightData;
      });

      // Transform to our format
      const formattedFlights: EcrewFlight[] = flights.map((flight: any) => ({
        date: flight.date || flight.Date || '',
        flightNumber: flight.flightNumber || flight.FlightNumber || flight.flight || '',
        departure: flight.departure || flight.Departure || flight.from || '',
        destination: flight.destination || flight.Destination || flight.to || '',
        departureTime: flight.departureTime || flight.DepartureTime || flight.depTime || '',
        arrivalTime: flight.arrivalTime || flight.ArrivalTime || flight.arrTime || '',
        aircraft: flight.aircraft || flight.Aircraft || flight.acType || '',
        coPilot: flight.coPilot || flight.CoPilot || undefined,
        status: 'scheduled' as const,
      })).filter(f => f.date && f.flightNumber);

      console.log(`Extracted ${formattedFlights.length} flights`);
      return formattedFlights;
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

// Main function to scrape eCrew schedule using Webix approach
export async function scrapeEcrewScheduleWebix(
  credentials: EcrewCredentials
): Promise<EcrewFlight[]> {
  const scraper = new EcrewScraperWebix();

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