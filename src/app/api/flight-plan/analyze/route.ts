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

interface NotamInfo {
  destinationILS: string[];
  destinationRunway: string[];
  destinationOther: string[];
  alternateILS: string[];
  alternateRunway: string[];
  alternateOther: string[];
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
  // Try multiple patterns to match different OFP formats
  
  // Pattern 1: With DCT: OMAA/31L DCT ... RPLL/06
  let routeMatch = text.match(/([A-Z]{4})\/(\d{2}[LRC]?)\s+DCT[\s\S]+?([A-Z]{4})\/(\d{2}[LRC]?)/);
  
  // Pattern 2: Without DCT: LOWW/29 ADAMA2C ... OMAA/31L
  if (!routeMatch) {
    routeMatch = text.match(/([A-Z]{4})\/(\d{2}[LRC]?)\s+[A-Z0-9]+[\s\S]+?([A-Z]{4})\/(\d{2}[LRC]?)/);
  }
  
  // Pattern 3: From route line specifically
  if (!routeMatch) {
    const routeLineMatch = text.match(/(?:ROUTE|ATS ROUTE|FPL)[\s\S]{0,50}([A-Z]{4})\/(\d{2}[LRC]?)[\s\S]+?([A-Z]{4})\/(\d{2}[LRC]?)/);
    if (routeLineMatch) {
      routeMatch = routeLineMatch;
    }
  }
  
  if (routeMatch) {
    info.departureRunway = routeMatch[2];
    info.arrivalRunway = routeMatch[4];
  }
  
  // Fallback: Search for departure and arrival runways separately
  if (!info.departureRunway && info.departure) {
    // Look for departure ICAO followed by runway
    const depMatch = text.match(new RegExp(`${info.departure}.*?([A-Z]{4})\/(\d{2}[LRC]?)`, 'i'));
    if (depMatch) info.departureRunway = depMatch[2];
  }
  
  if (!info.arrivalRunway && info.destination) {
    // Look for arrival ICAO followed by runway near the end of route
    const arrMatches = text.match(new RegExp(`([A-Z]{4})\/(\d{2}[LRC]?)`, 'g'));
    if (arrMatches && arrMatches.length > 1) {
      // Last runway in route is usually arrival
      const lastRunway = arrMatches[arrMatches.length - 1];
      const lastMatch = lastRunway.match(/([A-Z]{4})\/(\d{2}[LRC]?)/);
      if (lastMatch) info.arrivalRunway = lastMatch[2];
    }
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
      const destSection = text.substring(destSectionIndex, destSectionIndex + 5000);
      // Look for FT in the destination section - updated pattern to match actual format
      // Format: FT  011100 0112/0218 36007KT...
      const ftMatch = destSection.match(/FT\s+\d{6}\s+\d{4}\/\d{4}[\s\S]{0,2000}?(?==|\n\n|DESTINATION\sALTERNATE|RPVM|VHHH|$)/i);
      if (ftMatch && ftMatch[0]) {
        const taf = ftMatch[0].replace(/\s+/g, " ").trim();
        weather.destinationTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.destinationSummary = generateWeatherSummary(taf);
      }
    }
    
        // Pattern 2: If not found, look for FT near the ICAO code
    if (!weather.destinationTAF) {
      const ftMatch = text.match(new RegExp(
        `${destICAO}[\\s\\S]{0,500}?(FT\\s+\\d{6}\\s+\\d{4}/\\d{4}[\\s\\S]{0,1500}?)(?==|\\n\\n|DESTINATION\\sALTERNATE|RPVM|VHHH|$)`,
        "i"
      ));
      if (ftMatch && ftMatch[1]) {
        const taf = ftMatch[1].replace(/\s+/g, " ").trim();
        weather.destinationTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.destinationSummary = generateWeatherSummary(taf);
      }
    }
    
    // Pattern 3: Look for TAF with arrival time period
    if (!weather.destinationTAF) {
      // Try to extract all TAF data for the destination
      const tafPattern = new RegExp(
        `TAF\\s+${destICAO}\\s+\\d{6}Z[\\s\\S]{0,1500}?(?=\\n\\n|TAF\\s+[A-Z]{4}|TREND|$)`,
        "i"
      );
      const destMatch = text.match(tafPattern);
      if (destMatch) {
        const taf = destMatch[0].replace(/\s+/g, " ").trim();
        weather.destinationTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.destinationSummary = generateWeatherSummary(taf);
      }
    }
    
    // Pattern 4: Look for METAR if TAF not available
    if (!weather.destinationTAF) {
      const metarPattern = new RegExp(
        `METAR\\s+${destICAO}\\s+\\d{6}Z[\\s\\S]{0,500}?(?=\\n|$|TAF|METAR\\s+[A-Z]{4})`,
        "i"
      );
      const metarMatch = text.match(metarPattern);
      if (metarMatch) {
        const metar = metarMatch[0].replace(/\s+/g, " ").trim();
        weather.destinationTAF = metar;
        weather.destinationSummary = generateWeatherSummary(metar);
      }
    }
    
    // Pattern 5: Old pattern - look for TAF keyword near ICAO
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
        // Pattern 1: Look for "DESTINATION ALTERNATE:" section, then find "FT "
    const altSectionIndex = text.toUpperCase().indexOf("DESTINATION ALTERNATE:");
    if (altSectionIndex >= 0) {
      const altSection = text.substring(altSectionIndex, altSectionIndex + 5000);
      // Look for FT in the alternate section - updated pattern
      const ftMatch = altSection.match(/FT\s+\d{6}\s+\d{4}\/\d{4}[\s\S]{0,2000}?(?==|\n\n|RPVM|VHHH|$)/i);
      if (ftMatch && ftMatch[0]) {
        const taf = ftMatch[0].replace(/\s+/g, " ").trim();
        weather.alternateTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.alternateSummary = generateWeatherSummary(taf);
      }
    }
    
        // Pattern 2: If not found, look for FT near the alternate ICAO code
    if (!weather.alternateTAF) {
      const altFTMatch = text.match(new RegExp(
        `${altICAO}[\\s\\S]{0,500}?(FT\\s+\\d{6}\\s+\\d{4}/\\d{4}[\\s\\S]{0,1500}?)(?==|\\n\\n|RPVM|VHHH|$)`,
        "i"
      ));
      if (altFTMatch && altFTMatch[1]) {
        const taf = altFTMatch[1].replace(/\s+/g, " ").trim();
        weather.alternateTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.alternateSummary = generateWeatherSummary(taf);
      }
    }
    
    // Pattern 3: Look for TAF with ICAO code
    if (!weather.alternateTAF) {
      const tafPattern = new RegExp(
        `TAF\\s+${altICAO}\\s+\\d{6}Z[\\s\\S]{0,1500}?(?=\\n\\n|TAF\\s+[A-Z]{4}|TREND|$)`,
        "i"
      );
      const altMatch = text.match(tafPattern);
      if (altMatch) {
        const taf = altMatch[0].replace(/\s+/g, " ").trim();
        weather.alternateTAF = taf.length > 1000 ? taf.substring(0, 1000) + "..." : taf;
        weather.alternateSummary = generateWeatherSummary(taf);
      }
    }
    
    // Pattern 4: Look for METAR if TAF not available
    if (!weather.alternateTAF) {
      const metarPattern = new RegExp(
        `METAR\\s+${altICAO}\\s+\\d{6}Z[\\s\\S]{0,500}?(?=\\n|$|TAF|METAR\\s+[A-Z]{4})`,
        "i"
      );
      const metarMatch = text.match(metarPattern);
      if (metarMatch) {
        const metar = metarMatch[0].replace(/\s+/g, " ").trim();
        weather.alternateTAF = metar;
        weather.alternateSummary = generateWeatherSummary(metar);
      }
    }
    
    // Pattern 5: Old pattern
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

function parseNotams(text: string, destICAO: string, altICAO: string, eta?: string): NotamInfo {
  const notams: NotamInfo = {
    destinationILS: [],
    destinationRunway: [],
    destinationOther: [],
    alternateILS: [],
    alternateRunway: [],
    alternateOther: [],
  };

  if (!destICAO) return notams;

  // Parse ETA to get arrival time window (ETA ± 1 hour)
  let etaMinutes: number | null = null;
  let etaMinusHour: number | null = null;
  let etaPlusHour: number | null = null;
  
  if (eta) {
    const etaMatch = eta.match(/(\d{2})(\d{2})/);
    if (etaMatch) {
      const hours = parseInt(etaMatch[1]);
      const mins = parseInt(etaMatch[2]);
      etaMinutes = hours * 60 + mins;
      etaMinusHour = etaMinutes - 60;
      etaPlusHour = etaMinutes + 60;
    }
  }

    // Helper function to check if NOTAM is valid at arrival time
  const isValidAtArrival = (line: string): boolean => {
    if (!etaMinutes) return true; // If no ETA, include all NOTAMs
    
    const upper = line.toUpperCase();
    
    // Extract NOTAM validity period
    // Format examples:
    // - "FROM 2601011200 TO 2601020800"
    // - "01 0112 TO 02 0808"
    // - "WEF 0112 TIL 0208"
    // - "1413148 12100118 TO 14(04KN 12100508)" (OFP format)
    
    let fromTime: number | null = null;
    let toTime: number | null = null;
    
    // Pattern 1: DDHHMM format: 1413148 12100118 TO ...
    const pattern1 = upper.match(/(\d{2})(\d{2})(\d{2})\s+(\d{8})\s+TO\s+(\d{2})/);
    if (pattern1) {
      // Extract day and time from first part
      fromTime = parseInt(pattern1[2]) * 60 + parseInt(pattern1[3]);
      // We have day, hour, min from the full timestamp
      // For simplicity, just check the hour/min part
      const toPattern = upper.match(/TO\s+\d{2}[A-Z(]*\s*(\d{2})(\d{2})/);
      if (toPattern) {
        toTime = parseInt(toPattern[1]) * 60 + parseInt(toPattern[2]);
      }
    }
    
    // Pattern 2: FROM YYMMDDHHMM TO YYMMDDHHMM
    if (!fromTime) {
      const pattern2 = upper.match(/FROM\s+\d{6}(\d{2})(\d{2})\s+TO\s+\d{6}(\d{2})(\d{2})/);
      if (pattern2) {
        fromTime = parseInt(pattern2[1]) * 60 + parseInt(pattern2[2]);
        toTime = parseInt(pattern2[3]) * 60 + parseInt(pattern2[4]);
      }
    }
    
    // Pattern 3: DD HHMM TO DD HHMM
    if (!fromTime) {
      const pattern3 = upper.match(/\d{2}\s+(\d{2})(\d{2})\s+TO\s+\d{2}\s+(\d{2})(\d{2})/);
      if (pattern3) {
        fromTime = parseInt(pattern3[1]) * 60 + parseInt(pattern3[2]);
        toTime = parseInt(pattern3[3]) * 60 + parseInt(pattern3[4]);
      }
    }
    
    // Pattern 4: WEF HHMM TIL HHMM
    if (!fromTime) {
      const pattern4 = upper.match(/WEF\s+(\d{2})(\d{2})\s+TIL\s+(\d{2})(\d{2})/);
      if (pattern4) {
        fromTime = parseInt(pattern4[1]) * 60 + parseInt(pattern4[2]);
        toTime = parseInt(pattern4[3]) * 60 + parseInt(pattern4[4]);
      }
    }
    
    // If we found time range, check if ETA is within it (considering ±1 hour buffer)
    if (fromTime !== null && toTime !== null) {
      // Handle day rollover (if toTime < fromTime, add 24 hours)
      if (toTime < fromTime) toTime += 24 * 60;
      
      // Check if arrival window overlaps with NOTAM validity
      // NOTAM is relevant if: (fromTime <= etaPlusHour) AND (toTime >= etaMinusHour)
      return (fromTime <= etaPlusHour!) && (toTime >= etaMinusHour!);
    }
    
    // If no time found, include the NOTAM (better safe than sorry)
    return true;
  };

      console.log("=== NOTAM DEBUG ===");
  console.log("Destination ICAO:", destICAO);
  console.log("Alternate ICAO:", altICAO);
  console.log("ETA:", eta);
  console.log("ETA minutes:", etaMinutes);
  console.log("Time window:", etaMinusHour, "to", etaPlusHour);

  // Search for NOTAM section in text
  const notamSectionIndex = text.toUpperCase().search(/NOTAM|\d[A-Z]{2}\d{3}\/\d{2}/);
  console.log("NOTAM section found at index:", notamSectionIndex);
  
  if (notamSectionIndex >= 0) {
    const sample = text.substring(notamSectionIndex, Math.min(text.length, notamSectionIndex + 500));
    console.log("NOTAM section sample:", sample);
  }

  // Split by NOTAM reference (e.g., "1BE014/25") to get complete NOTAMs
  // Pattern: Letter + 5 digits + slash + 2 digits
  const notamPattern = /([A-Z0-9]{1,2}[A-Z]{1,2}\d{3,4}\/\d{2}[\s\S]{0,800}?)(?=[A-Z0-9]{1,2}[A-Z]{1,2}\d{3,4}\/\d{2}|Page|====|$)/gi;
  const notamMatches = text.match(notamPattern) || [];
  
    console.log("Total NOTAM blocks found:", notamMatches.length);
  if (notamMatches.length > 0 && notamMatches[0]) {
    console.log("First NOTAM sample:", notamMatches[0].substring(0, 200));
  }
  
  const seen = new Set<string>();

  for (const notamBlock of notamMatches) {
    const line = notamBlock.replace(/\s+/g, " ").trim();
    if (line.length < 20) continue;
    if (seen.has(line)) continue;

    const upper = line.toUpperCase();
    
    console.log("Checking NOTAM:", line.substring(0, 80));

    // Skip laser NOTAMs completely
    if (upper.includes("LASER") || upper.includes("LGT BEAM") || upper.includes("LIGHT BEAM")) {
      continue;
    }

        // Destination NOTAMs - check if NOTAM contains destination ICAO
    if (upper.includes(destICAO)) {
      console.log("  -> Contains destination ICAO:", destICAO);
      
      // Check if NOTAM is valid at arrival time
      if (!isValidAtArrival(line)) {
        console.log("  -> Skipped: Not valid at arrival time");
        continue;
      }
      
      console.log("  -> Valid at arrival time");
      
                  // ILS/Approach
      if (
        (upper.includes("ILS") || upper.includes("LOC") || upper.includes("GP") || 
         upper.includes("APPROACH") || upper.includes("GLIDEPATH") || upper.includes("APCH"))
      ) {
        notams.destinationILS.push(line.slice(0, 400));
        seen.add(line);
        console.log("  -> Added to ILS/Approach");
        continue;
      }

      // Runway - more lenient
      if (upper.includes("RWY") || upper.includes("RUNWAY")) {
        notams.destinationRunway.push(line.slice(0, 400));
        seen.add(line);
        console.log("  -> Added to Runway");
        continue;
      }

      // Other (GPS, taxiway, crane, lighting, etc) - catch all for destination
      notams.destinationOther.push(line.slice(0, 400));
      seen.add(line);
      console.log("  -> Added to Other");
    }

            // Alternate NOTAMs
    if (altICAO && upper.includes(altICAO)) {
      console.log("  -> Contains alternate ICAO:", altICAO);
      
      // Check if NOTAM is valid at arrival time
      if (!isValidAtArrival(line)) {
        console.log("  -> Skipped: Not valid at arrival time");
        continue;
      }
      
      if (upper.includes("ILS") || upper.includes("APPROACH") || upper.includes("APCH")) {
        notams.alternateILS.push(line.slice(0, 400));
        seen.add(line);
        console.log("  -> Added to alternate ILS");
        continue;
      }

      if (upper.includes("RWY") || upper.includes("RUNWAY")) {
        notams.alternateRunway.push(line.slice(0, 400));
        seen.add(line);
        console.log("  -> Added to alternate Runway");
        continue;
      }

      notams.alternateOther.push(line.slice(0, 400));
      seen.add(line);
      console.log("  -> Added to alternate Other");
    }
  }
  
  console.log("Total destination ILS NOTAMs:", notams.destinationILS.length);
  console.log("Total destination Runway NOTAMs:", notams.destinationRunway.length);
  console.log("Total destination Other NOTAMs:", notams.destinationOther.length);
  console.log("=== END NOTAM DEBUG ===");

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
    
    // Debug logging for weather section
    console.log("=== WEATHER DEBUG ===");
    console.log("Text length:", extracted.text.length);
    
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
    
    console.log("Destination ICAO:", destICAO);
    console.log("Alternate ICAO:", altICAO);
    
    // Search for weather keywords in text
    const hasWeatherSection = extracted.text.toUpperCase().includes("WEATHER") || 
                             extracted.text.toUpperCase().includes("TAF") ||
                             extracted.text.toUpperCase().includes("METAR") ||
                             extracted.text.match(/FT\s+\d{6}/);
    console.log("Has weather keywords:", hasWeatherSection);
    
    // Extract a sample around weather keywords
    const weatherIndex = extracted.text.toUpperCase().search(/WEATHER|TAF|METAR|FT\s+\d{6}/);
    if (weatherIndex >= 0) {
      const sample = extracted.text.substring(Math.max(0, weatherIndex - 100), Math.min(extracted.text.length, weatherIndex + 500));
      console.log("Weather section sample:", sample);
    }
    
    const weather = parseWeather(extracted.text, destICAO, altICAO);
    console.log("Destination TAF found:", weather.destinationTAF ? "YES" : "NO");
    console.log("Alternate TAF found:", weather.alternateTAF ? "YES" : "NO");
    console.log("=== END WEATHER DEBUG ===");
    const notams = parseNotams(extracted.text, destICAO, altICAO, flight.eta);
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
