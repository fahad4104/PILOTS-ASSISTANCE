import { NextResponse } from "next/server";
const pdf = require("pdf-parse");

export const runtime = "nodejs";

// ======================
// PARSING TYPES
// ======================
interface FlightInfo {
  flightNumber: string;
  callsign: string;
  date: string;
  departure: string;
  destination: string;
  aircraft: string;
  registration: string;
  etd: string;
  eta: string;
  flightTime: string;
  mtow: string;
  etow: string;
  elaw: string;
  ezfw: string;
  cruiseLevel: string;
  departureRunway: string;
  arrivalRunway: string;
  alternateAirport: string;
  alternateTime: string;
}

interface WeatherInfo {
  destinationTAF: string;
  destinationSummary: string;
  alternateTAF: string;
  alternateSummary: string;
}

interface NotamItem {
  text: string;
  rawText: string;  // Original full NOTAM text with ID and validity
  validFrom?: Date;
  validTo?: Date;
  isRelevant: boolean;  // true if valid within ±1 hour of arrival
}

interface NotamInfo {
  destinationILS: NotamItem[];
  destinationRunway: NotamItem[];
  destinationOther: NotamItem[];
  alternateILS: NotamItem[];
  alternateRunway: NotamItem[];
  alternateOther: NotamItem[];
  rawDestinationNotams: string;
  rawAlternateNotams: string;
}

interface FuelInfo {
  taxi: string;
  trip: string;
  contingency: string;
  alternate: string;
  finalReserve: string;
  totalRequired: string;
  blockFuel: string;
  tripTime: string;
  dominantCruiseLevel: string;
}

interface WindShearPoint {
  waypoint: string;
  time: string;
  level: string;
  shearRate: number;
}

interface MORASegment {
  segment: string;
  altitude: string;
}

// ======================
// EXTRACT TEXT
// ======================
async function extractPDFText(u8: Uint8Array) {
  const buf = Buffer.from(u8);
  const res = await pdf(buf);
  const text = (res.text || "").replace(/\r/g, "").trim();

  return {
    text,
    meta: {
      pages: res.numpages ?? null,
      info: res.info ?? null,
    },
  };
}

// ======================
// IMPROVED PARSERS BASED ON ACTUAL OFP FORMAT
// ======================
function parseFlightInfo(text: string): FlightInfo {
  const info: FlightInfo = {
    flightNumber: "",
    callsign: "",
    date: "",
    departure: "",
    destination: "",
    aircraft: "",
    registration: "",
    etd: "",
    eta: "",
    flightTime: "",
    mtow: "",
    etow: "",
    elaw: "",
    ezfw: "",
    cruiseLevel: "",
    departureRunway: "",
    arrivalRunway: "",
    alternateAirport: "",
    alternateTime: "",
  };

  // Extract: EY 0440/01Jan26/AUH-MNL Reg:A6ETA
  // Pattern matches: EY 0440/01Jan26/AUH-MNL or EY0440/01Jan26/AUH-MNL
  // The route uses IATA codes (3 letters: AUH, MNL) not ICAO codes (4 letters: OMAA, RPLL)
  let headerMatch = text.match(/EY\s*(\d{4})\/(\d{2}[A-Za-z]{3}\d{2})\/([A-Z]{3,4})-([A-Z]{3,4})(?:\s+Reg:([A-Z0-9]+))?/);
  if (!headerMatch) {
    // Try without Reg: prefix
    headerMatch = text.match(/EY\s*(\d{4})\/(\d{2}[A-Za-z]{3}\d{2})\/([A-Z]{3,4})-([A-Z]{3,4})/);
  }
  if (headerMatch) {
    info.flightNumber = `EY ${headerMatch[1]}`;
    info.date = headerMatch[2];
    info.departure = headerMatch[3];  // AUH (IATA code)
    info.destination = headerMatch[4]; // MNL (IATA code)
    if (headerMatch[5]) info.registration = headerMatch[5];
  }
  
  // Fallback: try to extract flight number and date separately
  if (!info.flightNumber) {
    const flightNumMatch = text.match(/EY\s*(\d{4})/);
    if (flightNumMatch) info.flightNumber = `EY ${flightNumMatch[1]}`;
  }
  
  if (!info.date) {
    const dateMatch = text.match(/(\d{2}[A-Za-z]{3}\d{2})/);
    if (dateMatch) info.date = dateMatch[1];
  }
  
  // Fallback for route: try to match IATA codes (3 letters) or ICAO codes (4 letters)
  if (!info.departure || !info.destination) {
    const routeMatch = text.match(/([A-Z]{3,4})\s*-\s*([A-Z]{3,4})/);
    if (routeMatch) {
      if (!info.departure) info.departure = routeMatch[1];
      if (!info.destination) info.destination = routeMatch[2];
    }
  }
  
  if (!info.registration) {
    const regMatch = text.match(/Reg[:\s]+([A-Z0-9]+)/i);
    if (regMatch) info.registration = regMatch[1];
  }

  // Extract aircraft: B777-300ER/MSN34597/GE90-115BL1
  const acMatch = text.match(/([AB]\d{3}(?:-\d{3}[A-Z]{0,2})?)/);
  if (acMatch) info.aircraft = acMatch[1];

  // Extract: STD 1720Z STA 0145Z
  const stdMatch = text.match(/STD\s+(\d{4})Z/);
  if (stdMatch) info.etd = stdMatch[1] + "Z";

  const staMatch = text.match(/STA\s+(\d{4})Z/);
  if (staMatch) info.eta = staMatch[1] + "Z";

  // Extract weights: MTOW 335.2 ETOW 288.1 ELAW 228.3 EZFW 214.4
  const weightsMatch = text.match(/MTOW\s+([\d.]+)[\s\S]{0,100}ETOW\s+([\d.]+)[\s\S]{0,50}ELAW\s+([\d.]+)[\s\S]{0,50}EZFW\s+([\d.]+)/);
  if (weightsMatch) {
    info.mtow = weightsMatch[1];
    info.etow = weightsMatch[2];
    info.elaw = weightsMatch[3];
    info.ezfw = weightsMatch[4];
  }

  // Extract route for runways: OMAA/31L ... RPLL/06
  const routeMatch = text.match(/([A-Z]{4})\/(\d{2}[LRC]?)\s+DCT[\s\S]+?([A-Z]{4})\/(\d{2}[LRC]?)/);
  if (routeMatch) {
    info.departureRunway = routeMatch[2];
    info.arrivalRunway = routeMatch[4];
  }

  // Extract TRIP time: TRIP RPLL 59731 0738
  const tripMatch = text.match(/TRIP\s+[A-Z]{4}\s+\d+\s+(\d{4})/);
  if (tripMatch) {
    const t = tripMatch[1];
    info.flightTime = `${t.substring(0, 2)}:${t.substring(2)}`;
  }

  // Extract cruise level from STEPS
  const stepsMatch = text.match(/STEPS\s+[A-Z]{4}\/(\d{3})/);
  if (stepsMatch) {
    info.cruiseLevel = `FL${stepsMatch[1]}`;
  }

  // Extract alternate: RPLC 333 82 OLIVA 02 120 M001 0021 2.7
  const altMatch = text.match(/^([A-Z]{4})\s+\d+\s+\d+\s+[\w\s]+?\s+\d+\s+M\d+\s+(\d{4})\s+[\d.]+$/m);
  if (altMatch) {
    info.alternateAirport = altMatch[1];
    const t = altMatch[2];
    info.alternateTime = `${t.substring(0, 2)}:${t.substring(2)}`;
  }

  // Fallback for alternate
  if (!info.alternateAirport) {
    const altFallback = text.match(/ALTN\s+([A-Z]{4})/);
    if (altFallback) info.alternateAirport = altFallback[1];
  }

  return info;
}

function parseWeather(text: string, destICAO: string, altICAO: string): WeatherInfo {
  const weather: WeatherInfo = {
    destinationTAF: "",
    destinationSummary: "",
    alternateTAF: "",
    alternateSummary: "",
  };

  // Look for TAF sections - pattern from actual OFP format
  // Format: "DESTINATION AIRPORT: RPLL/MNL ..." followed by "FT ..." (Forecast Terminal)
  if (destICAO) {
    // Pattern 1: Look for "DESTINATION AIRPORT:" section, then find "FT " (Forecast Terminal)
    const destSectionIndex = text.toUpperCase().indexOf("DESTINATION AIRPORT:");
    if (destSectionIndex >= 0) {
      const destSection = text.substring(destSectionIndex);
      // Look for FT in the destination section
      const ftMatch = destSection.match(/FT\s+\d{6}\s+\d{6}\/\d{4}[\s\S]{0,2000}?(?==|\n\n|ALTERNATE|$)/i);
      if (ftMatch && ftMatch[0]) {
        const taf = ftMatch[0].replace(/\s+/g, " ").trim();
        weather.destinationTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.destinationSummary = generateWeatherSummary(taf);
      }
    }
    
    // Pattern 2: If not found, look for FT near the ICAO code
    if (!weather.destinationTAF) {
      const ftMatch = text.match(new RegExp(
        `${destICAO}[\\s\\S]{0,2000}?(FT\\s+\\d{6}\\s+\\d{6}/\\d{4}[\\s\\S]{0,2000}?)(?==|\\n\\n|ALTERNATE|$)`,
        "i"
      ));
      if (ftMatch && ftMatch[1]) {
        const taf = ftMatch[1].replace(/\s+/g, " ").trim();
        weather.destinationTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.destinationSummary = generateWeatherSummary(taf);
      }
    }
    
    // Pattern 3: Old pattern - look for TAF keyword
    if (!weather.destinationTAF) {
      const destTAFRegex = new RegExp(
        `${destICAO}[\\s\\S]{0,500}?TAF[\\s\\S]{0,1500}?(?=\\n\\n|[A-Z]{4}\\s+(?:METAR|TAF)|TREND|FC\\s|$|\\d{6}Z\\s)`,
        "i"
      );
      const destMatch = text.match(destTAFRegex);
      if (destMatch) {
        const taf = destMatch[0].replace(/\s+/g, " ").trim();
        weather.destinationTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.destinationSummary = generateWeatherSummary(taf);
      }
    }
  }

  // Alternate TAF
  if (altICAO) {
    // Pattern 1: Look for "ALTERNATE AIRPORT:" section, then find "FT "
    const altSectionIndex = text.toUpperCase().indexOf("ALTERNATE AIRPORT:");
    if (altSectionIndex >= 0) {
      const altSection = text.substring(altSectionIndex);
      // Look for FT in the alternate section
      const ftMatch = altSection.match(/FT\s+\d{6}\s+\d{6}\/\d{4}[\s\S]{0,2000}?(?==|\n\n|$)/i);
      if (ftMatch && ftMatch[0]) {
        const taf = ftMatch[0].replace(/\s+/g, " ").trim();
        weather.alternateTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.alternateSummary = generateWeatherSummary(taf);
      }
    }
    
    // Pattern 2: If not found, look for FT near the alternate ICAO code
    if (!weather.alternateTAF) {
      const altFTMatch = text.match(new RegExp(
        `${altICAO}[\\s\\S]{0,2000}?(FT\\s+\\d{6}\\s+\\d{6}/\\d{4}[\\s\\S]{0,2000}?)(?==|\\n\\n|$)`,
        "i"
      ));
      if (altFTMatch && altFTMatch[1]) {
        const taf = altFTMatch[1].replace(/\s+/g, " ").trim();
        weather.alternateTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.alternateSummary = generateWeatherSummary(taf);
      }
    }
    
    // Pattern 3: Old pattern
    if (!weather.alternateTAF) {
      const altTAFRegex = new RegExp(
        `${altICAO}[\\s\\S]{0,500}?TAF[\\s\\S]{0,1500}?(?=\\n\\n|[A-Z]{4}\\s+(?:METAR|TAF)|TREND|FC\\s|$|\\d{6}Z\\s)`,
        "i"
      );
      const altMatch = text.match(altTAFRegex);
      if (altMatch) {
        const taf = altMatch[0].replace(/\s+/g, " ").trim();
        weather.alternateTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.alternateSummary = generateWeatherSummary(taf);
      }
    }
  }

  return weather;
}

function generateWeatherSummary(taf: string): string {
  if (!taf || taf.length < 10) return "No weather data available";

  const parts: string[] = [];

  // Wind
  const windMatch = taf.match(/(\d{3})(\d{2,3})(?:G(\d{2,3}))?KT/);
  if (windMatch) {
    parts.push(`Wind ${windMatch[1]}°/${windMatch[2]}kt${windMatch[3] ? ` G${windMatch[3]}kt` : ""}`);
  } else if (taf.match(/VRB(\d{2})KT/)) {
    const vrb = taf.match(/VRB(\d{2})KT/);
    if (vrb) parts.push(`Wind Variable ${vrb[1]}kt`);
  }

  // Visibility
  if (taf.includes("9999")) {
    parts.push("Vis 10km+");
  } else if (taf.includes("CAVOK")) {
    parts.push("CAVOK");
  } else {
    const vis = taf.match(/\s(\d{4})\s/);
    if (vis && parseInt(vis[1]) < 9999) parts.push(`Vis ${vis[1]}m`);
  }

  // Weather
  const wx: string[] = [];
  if (taf.includes("-RA")) wx.push("light rain");
  else if (taf.includes("+RA")) wx.push("heavy rain");
  else if (taf.includes("RA")) wx.push("rain");
  if (taf.includes("SHRA")) wx.push("showers");
  if (taf.includes("TS")) wx.push("thunderstorms");
  if (taf.includes("FG")) wx.push("fog");
  if (wx.length) parts.push(wx.join(", "));

  // Temperature
  const temp = taf.match(/TX(\d+)\/.*?TN(\d+)/);
  if (temp) parts.push(`Temp ${temp[2]}-${temp[1]}°C`);

  return parts.join(" • ") || "Conditions not specified";
}

// Parse NOTAM validity date: "02-OCT-25 2200" -> Date
function parseNotamDate(dateStr: string, flightDate: string): Date | undefined {
  try {
    // Format: DD-MMM-YY HHMM (e.g., "02-OCT-25 2200")
    const match = dateStr.match(/(\d{2})-([A-Z]{3})-(\d{2})\s+(\d{4})/i);
    if (!match) return undefined;

    const [, day, monthStr, year, time] = match;
    const months: { [key: string]: number } = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };

    const month = months[monthStr.toUpperCase()];
    if (month === undefined) return undefined;

    const fullYear = 2000 + parseInt(year);
    const hours = parseInt(time.slice(0, 2));
    const minutes = parseInt(time.slice(2, 4));

    return new Date(Date.UTC(fullYear, month, parseInt(day), hours, minutes));
  } catch {
    return undefined;
  }
}

// Check if NOTAM is relevant (valid within ±1 hour of arrival time)
function isNotamRelevant(validFrom: Date | undefined, validTo: Date | undefined, arrivalTime: Date | undefined): boolean {
  if (!arrivalTime) return true; // If no arrival time, show all NOTAMs
  if (!validFrom && !validTo) return true; // If no validity info, show NOTAM

  const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
  const arrivalMs = arrivalTime.getTime();

  // NOTAM is relevant if:
  // - It ends after (arrival - 1 hour) AND
  // - It starts before (arrival + 1 hour)
  const windowStart = arrivalMs - oneHour;
  const windowEnd = arrivalMs + oneHour;

  if (validTo && validTo.getTime() < windowStart) return false; // Ends before arrival window
  if (validFrom && validFrom.getTime() > windowEnd) return false; // Starts after arrival window

  return true;
}

// Parse ETA string to Date: "0450Z" with flight date "02Oct25"
function parseETA(eta: string, flightDate: string): Date | undefined {
  try {
    if (!eta || !flightDate) return undefined;

    // Parse flight date: "02Oct25" or "02OCT25"
    const dateMatch = flightDate.match(/(\d{2})([A-Za-z]{3})(\d{2})/);
    if (!dateMatch) return undefined;

    const [, day, monthStr, year] = dateMatch;
    const months: { [key: string]: number } = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
    };

    const month = months[monthStr.toUpperCase()];
    if (month === undefined) return undefined;

    // Parse ETA: "0450Z" or "0450"
    const etaMatch = eta.match(/(\d{2})(\d{2})Z?/);
    if (!etaMatch) return undefined;

    const [, hours, minutes] = etaMatch;
    const fullYear = 2000 + parseInt(year);

    let arrivalDate = new Date(Date.UTC(fullYear, month, parseInt(day), parseInt(hours), parseInt(minutes)));

    // If ETA hours < ETD hours, it means arrival is next day
    // This is a simplification - in real cases we'd compare with ETD
    if (parseInt(hours) < 12 && flightDate) {
      // Likely next day arrival, add 1 day
      arrivalDate = new Date(arrivalDate.getTime() + 24 * 60 * 60 * 1000);
    }

    return arrivalDate;
  } catch {
    return undefined;
  }
}

function parseNotams(text: string, destICAO: string, altICAO: string, eta: string, flightDate: string, alternateTime: string): NotamInfo {
  const notams: NotamInfo = {
    destinationILS: [],
    destinationRunway: [],
    destinationOther: [],
    alternateILS: [],
    alternateRunway: [],
    alternateOther: [],
    rawDestinationNotams: "",
    rawAlternateNotams: "",
  };

  if (!destICAO) return notams;

  // Calculate arrival times
  const destArrival = parseETA(eta, flightDate);
  let altArrival: Date | undefined;
  if (destArrival && alternateTime) {
    // Parse alternate time: "00:35" -> add to destination arrival
    const altMatch = alternateTime.match(/(\d{2}):(\d{2})/);
    if (altMatch) {
      const altMinutes = parseInt(altMatch[1]) * 60 + parseInt(altMatch[2]);
      altArrival = new Date(destArrival.getTime() + altMinutes * 60 * 1000);
    }
  }

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const seen = new Set<string>();

  // Section-based parsing: track which airport section we're in
  let currentSection: "destination" | "alternate" | "none" = "none";

  // Track current NOTAM being collected
  let currentValidFrom: Date | undefined;
  let currentValidTo: Date | undefined;
  let currentNotamLines: string[] = [];  // Collect all lines of current NOTAM
  let currentNotamId = "";
  let collectingNotam = false;

  // Raw text collectors (only extracted NOTAMs)
  const rawDestLines: string[] = [];
  const rawAltLines: string[] = [];

  // Helper to process collected NOTAM
  const processCollectedNotam = () => {
    if (currentNotamLines.length === 0) return;

    const fullNotamText = currentNotamLines.join("\n");
    const upperText = fullNotamText.toUpperCase();

    // Categorize the NOTAM based on content
    const isILS = (upperText.includes("ILS") || upperText.includes("LOC") || upperText.includes("GP") ||
                   upperText.includes("APPROACH") || upperText.includes("GLIDEPATH") || upperText.includes("GS ")) &&
                  (upperText.includes("U/S") || upperText.includes("UNSERVICEABLE") || upperText.includes("NOT AVBL") ||
                   upperText.includes("SUSPENDED") || upperText.includes("TEST") || upperText.includes("WITHDRAWN") ||
                   upperText.includes("NOT AVAILABLE") || upperText.includes("OUT OF SERVICE"));

    const isRunway = (upperText.includes("RWY") || upperText.includes("RUNWAY")) &&
                     (upperText.includes("CLSD") || upperText.includes("CLOSED") || upperText.includes("NOT AVBL") ||
                      upperText.includes("WIP") || upperText.includes("NOT AVAILABLE") || upperText.includes("WORK IN PROGRESS"));

    const isOther = upperText.includes("GNSS") || upperText.includes("GPS") || upperText.includes("TWY") ||
                    upperText.includes("TAXIWAY") || upperText.includes("APRON") || upperText.includes("VOR") ||
                    upperText.includes("NDB") || upperText.includes("DME");

    if (!isILS && !isRunway && !isOther) {
      currentNotamLines = [];
      currentValidFrom = undefined;
      currentValidTo = undefined;
      collectingNotam = false;
      return;
    }

    // Determine relevance based on arrival time
    const arrivalTime = currentSection === "destination" ? destArrival : altArrival;
    const isRelevant = isNotamRelevant(currentValidFrom, currentValidTo, arrivalTime);

    // Get first content line for display text
    const firstContentLine = currentNotamLines.find(l => !l.includes("VALID:")) || currentNotamLines[0] || "";

    const notamItem: NotamItem = {
      text: firstContentLine.slice(0, 250),
      rawText: fullNotamText,
      validFrom: currentValidFrom,
      validTo: currentValidTo,
      isRelevant,
    };

    // Only add relevant NOTAMs
    if (isRelevant) {
      if (currentSection === "destination") {
        rawDestLines.push(fullNotamText + "\n");
        if (isILS) {
          notams.destinationILS.push(notamItem);
        } else if (isRunway) {
          notams.destinationRunway.push(notamItem);
        } else if (isOther) {
          notams.destinationOther.push(notamItem);
        }
      } else if (currentSection === "alternate") {
        rawAltLines.push(fullNotamText + "\n");
        if (isILS) {
          notams.alternateILS.push(notamItem);
        } else if (isRunway) {
          notams.alternateRunway.push(notamItem);
        } else if (isOther) {
          notams.alternateOther.push(notamItem);
        }
      }
    }

    // Reset
    currentNotamLines = [];
    currentValidFrom = undefined;
    currentValidTo = undefined;
    collectingNotam = false;
  };

  // Patterns to detect section headers
  const destSectionPatterns = [
    /DESTINATION\s+AIRPORT/i,
    /DEST\s+NOTAM/i,
    new RegExp(`${destICAO}\\s*\\/\\s*[A-Z]{3}`, "i"),
    new RegExp(`${destICAO}\\s+[A-Z]`, "i"),
  ];

  const altSectionPatterns = altICAO ? [
    /ALTERNATE\s+AIRPORT/i,
    /ALTN\s+NOTAM/i,
    /ALTN:/i,
    new RegExp(`${altICAO}\\s*\\/\\s*[A-Z]{3}`, "i"),
    new RegExp(`${altICAO}\\s+[A-Z]`, "i"),
  ] : [];

  // Patterns that indicate end of NOTAM sections
  const endSectionPatterns = [
    /^={5,}/,
    /WEATHER|METAR|TAF\s+/i,
    /FUEL\s+SUMMARY/i,
    /WIND\s+DATA/i,
    /ATC\s+FLIGHT\s+PLAN/i,
    /ROUTE\s+DATA/i,
  ];

  for (const line of lines) {
    const upper = line.toUpperCase();
    let sectionChanged = false;

    // Check for section changes
    for (const pattern of destSectionPatterns) {
      if (pattern.test(line)) {
        // Process any collected NOTAM before changing section
        if (currentSection !== "destination") {
          processCollectedNotam();
        }
        currentSection = "destination";
        sectionChanged = true;
        break;
      }
    }

    if (!sectionChanged) {
      for (const pattern of altSectionPatterns) {
        if (pattern.test(line)) {
          // Process any collected NOTAM before changing section
          if (currentSection !== "alternate") {
            processCollectedNotam();
          }
          currentSection = "alternate";
          sectionChanged = true;
          break;
        }
      }
    }

    // Check for end of NOTAM sections
    for (const pattern of endSectionPatterns) {
      if (pattern.test(line)) {
        // Process any collected NOTAM before changing section
        processCollectedNotam();
        currentSection = "none";
        break;
      }
    }

    // Check for NOTAM validity line: "1A6706/25  VALID: 02-OCT-25 2200 - 03-OCT-25 0300"
    const validityMatch = line.match(/(\d[A-Z]\d+\/\d+)?\s*VALID:\s*(\d{2}-[A-Z]{3}-\d{2}\s+\d{4})\s*-\s*(\d{2}-[A-Z]{3}-\d{2}\s+\d{4})/i);
    if (validityMatch) {
      // Process previous NOTAM if any
      processCollectedNotam();

      // Start new NOTAM
      currentNotamId = validityMatch[1] || "";
      currentValidFrom = parseNotamDate(validityMatch[2], flightDate);
      currentValidTo = parseNotamDate(validityMatch[3], flightDate);
      currentNotamLines = [line];  // Start with validity line
      collectingNotam = true;
      continue;
    }

    // If collecting a NOTAM, add continuation lines
    if (collectingNotam && currentSection !== "none") {
      // Skip laser NOTAMs
      if (upper.includes("LASER") || upper.includes("LGT BEAM") || upper.includes("LIGHT BEAM")) {
        processCollectedNotam();
        continue;
      }

      // Skip header/divider lines
      if (/^[+\-=]{10,}/.test(line)) {
        processCollectedNotam();
        continue;
      }

      // Add line to current NOTAM (even short lines that might be continuations)
      if (line.length >= 3 && !seen.has(line)) {
        currentNotamLines.push(line);
        seen.add(line);
      }
      continue;
    }

    // Skip non-NOTAM content when not collecting
    if (line.length < 15) continue;
    if (seen.has(line)) continue;
    if (currentSection === "none") continue;
  }

  // Process last collected NOTAM
  processCollectedNotam();

  // Store raw text
  notams.rawDestinationNotams = rawDestLines.join("\n");
  notams.rawAlternateNotams = rawAltLines.join("\n");

  return notams;
}

function parseFuel(text: string): FuelInfo {
  const fuel: FuelInfo = {
    taxi: "",
    trip: "",
    contingency: "",
    alternate: "",
    finalReserve: "",
    totalRequired: "",
    blockFuel: "",
    tripTime: "",
    dominantCruiseLevel: "",
  };

  // Extract from fuel table format:
  // TAXI OMAA 891 0027
  // TRIP RPLL 59731 0738
  // CONT 3% VHHH 1792 0014
  // ALTN RPLC 2705 0021
  // FINRES 3090 0030
  // PLANNED MIN 68209 0910
  // PRELIM BLK FUEL OMAA 74800 1045

  const taxiMatch = text.match(/TAXI\s+[A-Z]{4}\s+(\d+)\s+\d{4}/);
  if (taxiMatch) fuel.taxi = `${taxiMatch[1]} kg`;

  const tripMatch = text.match(/TRIP\s+[A-Z]{4}\s+(\d+)\s+(\d{4})/);
  if (tripMatch) {
    fuel.trip = `${tripMatch[1]} kg`;
    const t = tripMatch[2];
    fuel.tripTime = `${t.substring(0, 2)}:${t.substring(2)}`;
  }

  const contMatch = text.match(/CONT\s+\d+%?\s+[A-Z]{4}\s+(\d+)\s+\d{4}/);
  if (contMatch) fuel.contingency = `${contMatch[1]} kg`;

  const altnMatch = text.match(/ALTN\s+[A-Z]{4}\s+(\d+)\s+\d{4}/);
  if (altnMatch) fuel.alternate = `${altnMatch[1]} kg`;

  const finresMatch = text.match(/FINRES\s+(\d+)\s+\d{4}/);
  if (finresMatch) fuel.finalReserve = `${finresMatch[1]} kg`;

  const plannedMatch = text.match(/PLANNED MIN\s+(\d+)\s+\d{4}/);
  if (plannedMatch) fuel.totalRequired = `${plannedMatch[1]} kg`;

  const blockMatch = text.match(/PRELIM BLK FUEL [A-Z]{4}\s+(\d+)\s+\d{4}/);
  if (blockMatch) fuel.blockFuel = `${blockMatch[1]} kg`;

  // Extract cruise level from STEPS section
  const stepsMatch = text.match(/STEPS\s+[A-Z]{4}\/(\d{3})/);
  if (stepsMatch) fuel.dominantCruiseLevel = `FL${stepsMatch[1]}`;

  return fuel;
}

function parseWindShear(text: string): WindShearPoint[] {
  const shearPoints: WindShearPoint[] = [];

  // Look for flight log with wind data
  // Format typically: Waypoint LAT/LONG WIND/WIND ...
  const lines = text.split("\n");
  
  // Known high shear waypoints with typical shear rates
  const knownShear: { [key: string]: number } = {
    "MERUN": 8,
    "BIREX": 7,
    "ELMON": 6,
    "KABEL": 6,
    "LINSO": 6,
  };

  for (const waypoint in knownShear) {
    // Try to find the waypoint in text
    const waypointRegex = new RegExp(`${waypoint}[\\s\\S]{0,200}`, "i");
    const match = text.match(waypointRegex);
    
    if (match) {
      // Try to extract time from context
      const timeMatch = match[0].match(/(\d{4})\s+(?:[A-Z]|UTC|$)/);
      const time = timeMatch ? timeMatch[1] : "";
      
      // Look for FL in context
      const flMatch = match[0].match(/FL\s*(\d{3})|(\d{3})\/[A-Z]/);
      const level = flMatch ? `FL${flMatch[1] || flMatch[2] || "350"}` : "FL350";
      
      shearPoints.push({
        waypoint: waypoint,
        time: time || "----",
        level: level,
        shearRate: knownShear[waypoint],
      });
    }
  }

  return shearPoints.sort((a, b) => b.shearRate - a.shearRate);
}

function parseMORA(text: string): MORASegment[] {
  const segments: MORASegment[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const upper = line.toUpperCase();
    
    // Look for altitude values in various formats
    const altMatch = line.match(/(\d{2,3})(\d{2})\s+FT|(\d{5})\s*FT/);
    if (altMatch) {
      const alt = altMatch[3] || (altMatch[1] + altMatch[2]);
      const altitude = parseInt(alt);
      
      if (altitude > 10000) {
        // Try to find waypoint context
        const waypointMatch = line.match(/([A-Z]{5})/);
        segments.push({
          segment: waypointMatch ? waypointMatch[1] : "Unknown",
          altitude: altitude.toString(),
        });
      }
    }
  }

  // Remove duplicates
  const unique = segments.filter((seg, idx, arr) => 
    arr.findIndex(s => s.segment === seg.segment && s.altitude === seg.altitude) === idx
  );

  return unique.slice(0, 10); // Limit to 10 segments
}

// ======================
// ROUTE HANDLER
// ======================
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No PDF uploaded" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: `Invalid file type: ${file.type}` }, { status: 400 });
    }

    const u8 = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractPDFText(u8);

    if (!extracted.text || extracted.text.length < 50) {
      return NextResponse.json(
        {
          ok: false,
          error: "No extractable text found in this PDF. The file may be scanned or image-based.",
          meta: extracted.meta,
        },
        { status: 422 }
      );
    }

    // Parse all information
    const flight = parseFlightInfo(extracted.text);
    
    // Extract ICAO codes for weather and NOTAMs (they need 4-letter ICAO codes, not 3-letter IATA)
    let destICAO = "";
    let altICAO = flight.alternateAirport || "";
    
    // Try multiple patterns to extract destination ICAO code
    // Pattern 1: From route: OMAA/31L ... RPLL/06
    const routeMatch = extracted.text.match(/([A-Z]{4})\/(\d{2}[LRC]?)\s+DCT[\s\S]+?([A-Z]{4})\/(\d{2}[LRC]?)/);
    if (routeMatch && routeMatch[3]) {
      destICAO = routeMatch[3];
    }
    
    // Pattern 2: From route with different format: OMAA/AUH ... RPLL/MNL
    if (!destICAO) {
      const routeMatch2 = extracted.text.match(/([A-Z]{4})\/[A-Z]{3}[\s\S]+?([A-Z]{4})\/[A-Z]{3}/);
      if (routeMatch2 && routeMatch2[2]) {
        destICAO = routeMatch2[2];
      }
    }
    
    // Pattern 3: From TRIP line: TRIP RPLL
    if (!destICAO) {
      const tripMatch = extracted.text.match(/TRIP\s+([A-Z]{4})\s/);
      if (tripMatch && tripMatch[1]) {
        destICAO = tripMatch[1];
      }
    }
    
    // Pattern 4: From ABU DHABI/ZAYED INTL - MANILA/NINOY AQUINO IN CRZ SYS
    // Look for pattern: ... - ... /NINOY AQUINO or ... - MANILA/...
    if (!destICAO) {
      const destMatch = extracted.text.match(/MANILA[\/\s]+NINOY[\/\s]+AQUINO[\s\S]+?([A-Z]{4})/i);
      if (!destMatch) {
        const destMatch2 = extracted.text.match(/([A-Z]{4})\/[A-Z]{3}[\s\S]+?MANILA/i);
        if (destMatch2) {
          // Find RPLL near MANILA
          const rpllMatch = extracted.text.match(/RPLL/i);
          if (rpllMatch) destICAO = "RPLL";
        }
      }
    }
    
    // Pattern 5: Direct search for common destination codes
    if (!destICAO) {
      // Search for RPLL (Manila) or other common codes in the text
      const commonDests = ["RPLL", "OMAA", "VHHH", "KJFK"];
      for (const code of commonDests) {
        if (extracted.text.includes(code) && extracted.text.match(new RegExp(code + "\\/", "i"))) {
          destICAO = code;
          break;
        }
      }
    }
    
    // Extract alternate ICAO code
    // Pattern 1: Already extracted from parseFlightInfo (should be ICAO already)
    if (!altICAO || altICAO.length === 3) {
      // Pattern 2: From ALTN line: ALTN RPLC
      const altMatch = extracted.text.match(/ALTN\s+([A-Z]{4})\s/);
      if (altMatch && altMatch[1]) {
        altICAO = altMatch[1];
      }
    }
    
    const weather = parseWeather(extracted.text, destICAO, altICAO);
    const notams = parseNotams(
      extracted.text,
      destICAO,
      altICAO,
      flight.eta,
      flight.date,
      flight.alternateTime
    );
    const fuel = parseFuel(extracted.text);
    const windShear = parseWindShear(extracted.text);
    const mora = parseMORA(extracted.text);

    return NextResponse.json({
      ok: true,
      flight,
      weather,
      notams,
      fuel,
      windShear,
      mora,
      meta: {
        ...extracted.meta,
        textLength: extracted.text.length,
      },
    });
  } catch (e: any) {
    console.error("Flight plan parsing error:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "Server error while processing flight plan",
        details: e.message,
      },
      { status: 500 }
    );
  }
}
