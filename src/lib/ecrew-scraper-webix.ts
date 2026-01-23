import { Browser, Page } from 'puppeteer-core';
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

      console.log('Filling in credentials using Webix-aware input set...');

      const crewIdSelector = 'input[placeholder="Crew ID"]';
      const passwordSelector = 'input[placeholder="Password"], input[type="password"]';

      await this.page.waitForSelector(crewIdSelector, { timeout: 30000 });
      await this.page.waitForSelector(passwordSelector, { timeout: 30000 });

      const loginResult = await this.page.evaluate(
        (crewId, plainPassword) => {
          const setValue = (placeholder: string, value: string) => {
            const input = document.querySelector(
              `input[placeholder="${placeholder}"]`
            ) as HTMLInputElement | null;
            if (!input) {
              return { ok: false, error: `${placeholder} field not found` };
            }

            input.focus();
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            const container = input.closest('[view_id]');
            const webixLookup = (window as any).$$;
            if (container && typeof webixLookup === 'function') {
              const viewId = container.getAttribute('view_id');
              const view = viewId ? webixLookup(viewId) : null;
              if (view && typeof view.setValue === 'function') {
                view.setValue(value);
              }
            }

            return { ok: true };
          };

          const crewRes = setValue('Crew ID', crewId);
          if (!crewRes.ok) {
            return { success: false, error: crewRes.error };
          }

          const passRes = setValue('Password', plainPassword);
          if (!passRes.ok) {
            return { success: false, error: passRes.error };
          }

          const crewVal =
            (document.querySelector('input[placeholder="Crew ID"]') as HTMLInputElement | null)
              ?.value || '';

          const webixLookup = (window as any).$$;
          if (typeof webixLookup === 'function') {
            const loginView = webixLookup('loginbtn');
            if (loginView && typeof loginView.callEvent === 'function') {
              loginView.callEvent('onItemClick', []);
            }
          }

          const loginButton =
            (document.querySelector('[view_id="loginbtn"] button') as HTMLButtonElement | null) ||
            (document.querySelector('.webix_el_button.webix_primary button') as HTMLButtonElement | null);

          if (loginButton) {
            loginButton.click();
          } else {
            const buttons = Array.from(document.querySelectorAll('button'));
            const fallback = buttons.find((btn) =>
              (btn.textContent || '').toLowerCase().includes('log in')
            );
            if (fallback) {
              (fallback as HTMLButtonElement).click();
            }
          }

          return { success: true, crewVal };
        },
        credentials.employeeId,
        credentials.password
      );

      if (!loginResult.success) {
        throw new Error(`Webix login failed: ${loginResult.error}`);
      }

      if (loginResult.crewVal !== credentials.employeeId) {
        console.warn(`Crew ID mismatch after set: ${loginResult.crewVal}`);
      }

      console.log('Login form submitted, waiting for response...');

      // Trigger Enter on password field as a fallback submit
      try {
        await this.page.focus(passwordSelector);
        await this.page.keyboard.press('Enter');
      } catch {
        // ignore
      }

      // Wait for navigation or login form to disappear
      await Promise.race([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null),
        this.page
          .waitForFunction(
            () => {
              const crewIdInput = document.querySelector('input[placeholder="Crew ID"]');
              const passwordInput = document.querySelector('input[placeholder="Password"], input[type="password"]');
              return !crewIdInput && !passwordInput;
            },
            { timeout: 15000 }
          )
          .catch(() => null),
      ]);

      // Check for error messages
      const errorMessage = await this.page.evaluate(() => {
        // Look for error messages in Webix notifications
        const notifications = document.querySelectorAll('.webix_message_area .webix_error, .webix_message_area [class*="error"]');
        if (notifications.length > 0) {
          return notifications[0].textContent?.trim() || null;
        }

        const inlineError = document.querySelector('.webix_inp_bottom_label');
        if (inlineError && inlineError.textContent?.trim()) {
          return inlineError.textContent.trim();
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

      // Check if we're redirected to dashboard or login form disappears
      const currentUrl = this.page.url();
      console.log('Current URL after login:', currentUrl);

      const loginFormStillVisible = await this.page.evaluate(() => {
        const crewIdInput = document.querySelector('input[placeholder="Crew ID"]');
        const passwordInput = document.querySelector('input[placeholder="Password"], input[type="password"]');
        return Boolean(crewIdInput || passwordInput);
      });

      if (!loginFormStillVisible || currentUrl.toLowerCase().includes('dashboard')) {
        console.log('Login successful!');
        return true;
      }

      // If we're still on the login page after wait, assume failure
      if (currentUrl.includes('/ecrew')) {
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

      // Try to find and click on "Crew Schedule" then "My Schedule"
      const scheduleClicked = await this.page.evaluate(() => {
        try {
          const lowerText = (el: Element) => (el.textContent || '').toLowerCase().trim();
          const links = Array.from(document.querySelectorAll('a, span, div'));

          const crewSchedule = links.find((el) => lowerText(el) === 'crew schedule');
          if (crewSchedule) {
            (crewSchedule as HTMLElement).click();
          }

          const mySchedule = links.find((el) => lowerText(el) === 'my schedule');
          if (mySchedule) {
            (mySchedule as HTMLElement).click();
            return true;
          }

          const scheduleLink = links.find((el) => {
            const text = lowerText(el);
            return text.includes('schedule') || text.includes('roster');
          });
          if (scheduleLink) {
            (scheduleLink as HTMLElement).click();
            return true;
          }

          const anchor = document.querySelector(
            'a[href*="schedule"], a[href*="roster"], a[href*="my-schedule"]'
          ) as HTMLAnchorElement | null;
          if (anchor?.href) {
            window.location.href = anchor.href;
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
          process.env.ECREW_SCHEDULE_URL,
          'https://ecrew.etihad.ae/eCrew/Dashboard',
          'https://ecrew.etihad.ae/ecrew/schedule',
          'https://ecrew.etihad.ae/ecrew/roster',
          'https://ecrew.etihad.ae/ecrew/my-schedule',
          'https://ecrew.etihad.ae/ecrew/roster/#/schedule',
          'https://ecrew.etihad.ae/ecrew/#/schedule',
        ].filter(Boolean) as string[];

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

      // Give Webix data table a moment to render if present
      await this.page
        .waitForFunction(
          () => Boolean(document.querySelector('.webix_dtable, [view_id*="schedule"], [view_id*="roster"]')),
          { timeout: 10000 }
        )
        .catch(() => null);

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

      // Wait for CrewSchedule iframe when present
      await this.page
        .waitForFunction(
          () => Boolean(document.querySelector('iframe[src*="CrewSchedule"]')),
          { timeout: 10000 }
        )
        .catch(() => null);

      // Log frame URLs to find schedule inside iframe if present
      const frames = this.page.frames();
      const frameInfo = frames.map((frame) => ({
        name: frame.name(),
        url: frame.url(),
      }));
      console.log('Frames detected:', frameInfo);

      // Take a screenshot for debugging
      try {
        await this.page.screenshot({ path: '/tmp/ecrew-schedule.png', fullPage: true });
        console.log('Screenshot saved: /tmp/ecrew-schedule.png');
      } catch (screenshotError) {
        console.log('Could not save screenshot');
      }

      const extractFromContext = async (ctx: any) => {
        return await ctx.evaluate(() => {
          const flightData: any[] = [];
          const debugViews: Array<{
            viewId: string;
            viewType?: string;
            name?: string;
            dataCount?: number;
            src?: string;
          }> = [];
          const debugMeta = {
            hasWebix: false,
            webixIsFunction: false,
            hasScheduler: false,
            schedulerEventCount: 0,
            schedulerViewFound: false,
            schedulerViewEventCount: 0,
            hasDp: false,
            dpEventCount: 0,
            hasDhxDom: false,
            dhxEventDomCount: 0,
            tableCount: 0,
          };

          // Try to find Webix datatable or grid
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const webixGlobal = (window as any).$$;
          if (typeof webixGlobal !== 'undefined') {
            debugMeta.hasWebix = true;
            debugMeta.webixIsFunction = typeof webixGlobal === 'function';
            // Look for Webix datatables
            const datatables = document.querySelectorAll('[view_id]');
            for (const table of datatables) {
              try {
                const viewId = table.getAttribute('view_id');
                if (viewId) {
                  const webixTable = webixGlobal(viewId);
                  if (webixTable && webixTable.config) {
                    const viewType = webixTable.config.view;
                    debugViews.push({
                      viewId,
                      viewType,
                      name: webixTable.config.name,
                      dataCount: webixTable.data?.count?.(),
                      src: webixTable.config.src,
                    });

                    const isSchedulerView = viewId === 'scheduler' || viewType === 'scheduler';
                    const shouldUseData = isSchedulerView || viewType === 'datatable' || viewType === 'treetable';

                    if (isSchedulerView) {
                      debugMeta.schedulerViewFound = true;
                      try {
                        if (typeof webixTable.getEvents === 'function') {
                          const events = webixTable.getEvents();
                          if (Array.isArray(events) && events.length > 0) {
                            debugMeta.schedulerViewEventCount = events.length;
                            flightData.push(...events);
                          }
                        } else if (typeof webixTable.getService === 'function') {
                          const service = webixTable.getService('local');
                          const data = service?.data?.serialize?.();
                          if (data && data.length > 0) {
                            debugMeta.schedulerViewEventCount = data.length;
                            flightData.push(...data);
                          }
                        } else if (typeof webixTable.getState === 'function') {
                          const state = webixTable.getState();
                          const events = state?.events;
                          if (Array.isArray(events) && events.length > 0) {
                            debugMeta.schedulerViewEventCount = events.length;
                            flightData.push(...events);
                          }
                        }
                      } catch {
                        // ignore scheduler extraction errors
                      }
                    }

                    if (shouldUseData && typeof webixTable.data !== 'undefined') {
                      const data = webixTable.data.serialize();
                      if (data && data.length > 0) {
                        flightData.push(...data);
                      }
                    }
                  }
                }
              } catch (e) {
                continue;
              }
            }
          }

          // If no Webix data, try scheduler events (dhtmlx-style)
          if (flightData.length === 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const scheduler = (window as any).scheduler;
            if (scheduler && typeof scheduler.getEvents === 'function') {
              debugMeta.hasScheduler = true;
              const events = scheduler.getEvents();
              if (Array.isArray(events)) {
                debugMeta.schedulerEventCount = events.length;
                if (events.length > 0) {
                  flightData.push(...events);
                }
              }
            }
          }

          // Try Webix scheduler view by ID
          if (flightData.length === 0 && typeof webixGlobal === 'function') {
            const schedulerView = webixGlobal('scheduler');
            if (schedulerView) {
              debugMeta.schedulerViewFound = true;
              if (typeof schedulerView.getEvents === 'function') {
                const events = schedulerView.getEvents();
                if (Array.isArray(events)) {
                  debugMeta.schedulerViewEventCount = events.length;
                  if (events.length > 0) {
                    flightData.push(...events);
                  }
                }
              } else if (schedulerView.data && typeof schedulerView.data.serialize === 'function') {
                const data = schedulerView.data.serialize();
                if (data && data.length > 0) {
                  debugMeta.schedulerViewEventCount = data.length;
                  flightData.push(...data);
                }
              }
            }
          }

          if (flightData.length === 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dpList = (window as any).dp?.events?.list;
            if (Array.isArray(dpList)) {
              debugMeta.hasDp = true;
              debugMeta.dpEventCount = dpList.length;
              if (dpList.length > 0) {
                flightData.push(...dpList);
              }
            }
          }

          if (flightData.length === 0) {
            const dhxEvents = document.querySelectorAll('.dhx_cal_event, .dhx_cal_event_clear, .dhx_cal_event_line');
            if (dhxEvents.length > 0) {
              debugMeta.hasDhxDom = true;
              debugMeta.dhxEventDomCount = dhxEvents.length;
            }
          }

          // If still no data, try HTML tables
          if (flightData.length === 0) {
            const tables = document.querySelectorAll('table');
            debugMeta.tableCount = tables.length;
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

          return { flightData, debugViews, debugMeta };
        });
      };

      // Extract flight data from main page
      const extraction = await extractFromContext(this.page);
      if (extraction.debugViews?.length) {
        console.log('Webix views detected:', extraction.debugViews);
      }
      if (extraction.debugMeta) {
        console.log('Extraction meta:', extraction.debugMeta);
      }

      const scheduleFrame = frames.find((frame) => frame.url().includes('CrewSchedule')) ||
        frames.find((frame) => frame.url().includes('HomeIndex'));

      let combinedFlights = extraction.flightData;
      console.log('Raw flight records from main context:', combinedFlights.length);

      let frameTried = false;
      const tryFrameExtraction = async () => {
        if (frameTried || !scheduleFrame) return 0;
        frameTried = true;
        let added = 0;

        try {
          await scheduleFrame.waitForSelector('body', { timeout: 10000 });
          const frameExtraction = await extractFromContext(scheduleFrame);
          if (frameExtraction.debugViews?.length) {
            console.log('Webix views detected (frame):', scheduleFrame.url(), frameExtraction.debugViews);
          }
          if (frameExtraction.debugMeta) {
            console.log('Extraction meta (frame):', scheduleFrame.url(), frameExtraction.debugMeta);
          }
          if (frameExtraction.flightData?.length) {
            combinedFlights = combinedFlights.concat(frameExtraction.flightData);
            added += frameExtraction.flightData.length;
          }

          const childFrames = scheduleFrame.childFrames();
          for (const child of childFrames) {
            try {
              await child.waitForSelector('body', { timeout: 10000 });
              const childExtraction = await extractFromContext(child);
              if (childExtraction.debugViews?.length) {
                console.log('Webix views detected (child frame):', child.url(), childExtraction.debugViews);
              }
              if (childExtraction.debugMeta) {
                console.log('Extraction meta (child frame):', child.url(), childExtraction.debugMeta);
              }
              if (childExtraction.flightData?.length) {
                combinedFlights = combinedFlights.concat(childExtraction.flightData);
                added += childExtraction.flightData.length;
              }
            } catch (frameErr) {
              console.log('Child frame extraction error:', String(frameErr));
            }
          }
        } catch (frameErr) {
          console.log('Schedule frame extraction error:', String(frameErr));
        }

        // Fallback: try all frames once
        if (added == 0 && frames.length > 1) {
          for (const frame of frames) {
            try {
              const frameExtraction = await extractFromContext(frame);
              if (frameExtraction.debugViews?.length) {
                console.log('Webix views detected (frame):', frame.url(), frameExtraction.debugViews);
              }
              if (frameExtraction.debugMeta) {
                console.log('Extraction meta (frame):', frame.url(), frameExtraction.debugMeta);
              }
              if (frameExtraction.flightData?.length) {
                combinedFlights = combinedFlights.concat(frameExtraction.flightData);
                added += frameExtraction.flightData.length;
              }
            } catch {
              // ignore frame errors
            }
          }
        }

        return added;
      };

      if (combinedFlights.length === 0) {
        await tryFrameExtraction();
      }
      // Transform to our format
      const toDate = (value: any) => {
        if (!value) return null;
        const d = new Date(value as any);
        return Number.isNaN(d.getTime()) ? null : d;
      };
      const toUpper = (value: any) => String(value || '').toUpperCase();
      const extractFlightNumber = (value: any) => {
        const match = toUpper(value).match(/\b[A-Z]{1,3}\d{1,4}\b/);
        return match ? match[0] : '';
      };
      const extractRoute = (value: any) => {
        const matches = toUpper(value).match(/\b[A-Z]{3}\b/g);
        if (matches && matches.length >= 2) {
          return { from: matches[0], to: matches[1] };
        }
        return null;
      };

      const transformFlights = (source: any[]) => source.map((flight: any) => {
        const start = toDate(flight.start_date || flight.startDate || flight.start);
        const end = toDate(flight.end_date || flight.endDate || flight.end);
        const dateValue = flight.date || flight.Date || (start ? start.toISOString().slice(0, 10) : '');
        const depTimeValue = flight.departureTime || flight.DepartureTime || flight.depTime ||
          (start ? start.toISOString().slice(11, 16) : '');
        const arrTimeValue = flight.arrivalTime || flight.ArrivalTime || flight.arrTime ||
          (end ? end.toISOString().slice(11, 16) : '');
        const flightText = String(
          flight.text || flight.title || flight.name || flight.value || ''
        ).trim();
        const routeSource = flight.route || flight.sector || flight.pairing || flightText;
        const route = extractRoute(routeSource);
        const departure = flight.departure || flight.Departure || flight.from || flight.origin || route?.from || '';
        const destination = flight.destination || flight.Destination || flight.to || flight.dest || route?.to || '';
        const flightNumber =
          flight.flightNumber ||
          flight.FlightNumber ||
          flight.flight ||
          extractFlightNumber(flightText) ||
          flightText;

        return {
          date: dateValue,
          flightNumber,
          departure,
          destination,
          departureTime: depTimeValue,
          arrivalTime: arrTimeValue,
          aircraft: flight.aircraft || flight.Aircraft || flight.acType || '',
          coPilot: flight.coPilot || flight.CoPilot || undefined,
          status: 'scheduled' as const,
        };
      }).filter(f => f.date && f.flightNumber);

      let formattedFlights: EcrewFlight[] = transformFlights(combinedFlights);
      if (formattedFlights.length === 0 && combinedFlights.length > 0) {
        const sample = combinedFlights[0];
        if (sample && typeof sample === 'object') {
          console.log('Sample raw flight record keys:', Object.keys(sample));
        }
      }
      if (formattedFlights.length === 0) {
        const added = await tryFrameExtraction();
        if (added > 0) {
          formattedFlights = transformFlights(combinedFlights);
        }
      }

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
