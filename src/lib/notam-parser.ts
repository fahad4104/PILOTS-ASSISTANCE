/**
 * NOTAM Parser for LIDO Bulletin Format
 * Parses NOTAMs and filters based on flight times (ETD/ETA)
 */

// ============== TYPES ==============

export type EndKind = "UFN" | "PERM" | "EST" | "DATED" | "UNKNOWN";

export interface Validity {
  startUtc: Date | null;
  endUtc: Date | null;
  endKind: EndKind;
  raw: string;
}

export interface Schedule {
  days: string[];
  startHHMM: string;
  endHHMM: string;
  spansMidnight: boolean;
  raw: string;
}

export interface NotamRecord {
  airport: string;
  idRaw: string;
  idType: "notam" | "aip_sup" | "aic";
  validity: Validity;
  schedule: Schedule[];
  text: string;
  category?: string;
  tags: string[];
  parseWarnings: string[];
}

export interface FlightTimes {
  dep: string;
  dest: string;
  altn: string[];
  etdUtc: Date;
  etaUtc: Date;
  altnEtaUtc: Record<string, Date>;
}

export interface ActiveStatus {
  isActive: boolean;
  reason: string;
}

export interface NotamWithStatus extends NotamRecord {
  active: {
    dep: ActiveStatus;
    dest: ActiveStatus;
    altn: Record<string, ActiveStatus>;
  };
}

export interface ParsedNotamBulletin {
  source: string;
  flight: FlightTimes;
  notams: NotamWithStatus[];
  parseWarnings: string[];
}

// ============== REGEX PATTERNS ==============

const REGEX = {
  // Airport ICAO code header
  airportHeader: /^([A-Z]{4})(?:\s|\/|$)/,

  // NOTAM ID patterns
  notamId: /^([A-Z0-9]{1,3}\d{1,5}\/\d{2})\b/,
  aipSup: /^(AIP\s+SUP)\s+([A-Z]{1,3}\d{3,5}\/\d{2})\b/i,
  aic: /^(AIC)\s+([A-Z]{1,3}\d{3,5}\/\d{2})\b/i,

  // Validity patterns
  validityTillUfn: /^VALIDITY:\s*(\d{1,2}[A-Z]{3}\d{2})\s+TILL\s+(UFN|PERM)\s*$/i,
  validityDashUfn: /^VALIDITY:\s*(\d{1,2}[A-Z]{3}\d{2})\s*-\s*(UFN|PERM)\s*$/i,
  validityDateRange: /^VALIDITY:\s*(\d{1,2}[A-Z]{3}\d{2})\s*-\s*(\d{1,2}[A-Z]{3}\d{2})\s*$/i,
  validityFullDateTime: /(\d{2}-[A-Z]{3}-\d{2}\s+\d{4})\s*-\s*(\d{2}-[A-Z]{3}-\d{2}\s+\d{4})/i,
  validityBulletin: /^VALID:\s*(\d{10})\s*-\s*(\d{10})/i,

  // Schedule patterns
  scheduleTime: /^(\d{4})\s*-\s*(\d{4})\s*$/,
  scheduleDays: /\b(DLY|MON|TUE|WED|THU|FRI|SAT|SUN)(?:\s*-\s*(MON|TUE|WED|THU|FRI|SAT|SUN))?\b/gi,

  // Category detection
  runway: /\bRWY\b|\bRUNWAY\b/i,
  ils: /\bILS\b|\bLOC\b|\bGS\b/i,
  lighting: /\bLGT\b|\bLIGHT\b/i,
  crane: /\bCRANE\b|\bOBST\b/i,
  airspace: /\bAIRSPACE\b|\bTMA\b|\bCTR\b/i,
  nav: /\bVOR\b|\bNDB\b|\bDME\b/i,
};

// ============== DATE PARSING ==============

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/**
 * Parse date like "6FEB25" or "26JUN25"
 */
function parseDateDDMMMYY(str: string): Date | null {
  const match = str.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/i);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2].toUpperCase()];
  const year = 2000 + parseInt(match[3], 10);

  if (month === undefined) return null;

  return new Date(Date.UTC(year, month, day, 0, 0, 0));
}

/**
 * Parse date like "02-OCT-25 0135"
 */
function parseDateDDMMMYYHHMM(str: string): Date | null {
  const match = str.match(/^(\d{2})-([A-Z]{3})-(\d{2})\s+(\d{4})$/i);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2].toUpperCase()];
  const year = 2000 + parseInt(match[3], 10);
  const hhmm = match[4];
  const hours = parseInt(hhmm.substring(0, 2), 10);
  const minutes = parseInt(hhmm.substring(2, 4), 10);

  if (month === undefined) return null;

  return new Date(Date.UTC(year, month, day, hours, minutes, 0));
}

/**
 * Parse bulletin validity like "2510030135" (YYMMDDHHMM)
 */
function parseBulletinDateTime(str: string): Date | null {
  if (str.length !== 10) return null;

  const year = 2000 + parseInt(str.substring(0, 2), 10);
  const month = parseInt(str.substring(2, 4), 10) - 1;
  const day = parseInt(str.substring(4, 6), 10);
  const hours = parseInt(str.substring(6, 8), 10);
  const minutes = parseInt(str.substring(8, 10), 10);

  return new Date(Date.UTC(year, month, day, hours, minutes, 0));
}

// ============== VALIDITY PARSING ==============

function parseValidity(lines: string[]): Validity {
  const result: Validity = {
    startUtc: null,
    endUtc: null,
    endKind: "UNKNOWN",
    raw: "",
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Pattern: "VALIDITY: 6FEB25 TILL UFN"
    let match = trimmed.match(REGEX.validityTillUfn);
    if (match) {
      result.startUtc = parseDateDDMMMYY(match[1]);
      result.endUtc = null;
      result.endKind = match[2].toUpperCase() as EndKind;
      result.raw = trimmed;
      return result;
    }

    // Pattern: "VALIDITY: 26JUN25 - UFN"
    match = trimmed.match(REGEX.validityDashUfn);
    if (match) {
      result.startUtc = parseDateDDMMMYY(match[1]);
      result.endUtc = null;
      result.endKind = match[2].toUpperCase() as EndKind;
      result.raw = trimmed;
      return result;
    }

    // Pattern: "VALIDITY: 26JUN25 - 30DEC25"
    match = trimmed.match(REGEX.validityDateRange);
    if (match) {
      result.startUtc = parseDateDDMMMYY(match[1]);
      result.endUtc = parseDateDDMMMYY(match[2]);
      result.endKind = "DATED";
      result.raw = trimmed;
      return result;
    }

    // Pattern: "02-OCT-25 0135 - 02-OCT-25 2359"
    match = trimmed.match(REGEX.validityFullDateTime);
    if (match) {
      result.startUtc = parseDateDDMMMYYHHMM(match[1]);
      result.endUtc = parseDateDDMMMYYHHMM(match[2]);
      result.endKind = "DATED";
      result.raw = trimmed;
      return result;
    }

    // Pattern: "VALID: 2510030135 - 2510031102"
    match = trimmed.match(REGEX.validityBulletin);
    if (match) {
      result.startUtc = parseBulletinDateTime(match[1]);
      result.endUtc = parseBulletinDateTime(match[2]);
      result.endKind = "DATED";
      result.raw = trimmed;
      return result;
    }
  }

  return result;
}

// ============== SCHEDULE PARSING ==============

function parseSchedules(lines: string[]): Schedule[] {
  const schedules: Schedule[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Pattern: "1500-0230"
    const match = trimmed.match(REGEX.scheduleTime);
    if (match) {
      const startHHMM = match[1];
      const endHHMM = match[2];
      const startNum = parseInt(startHHMM, 10);
      const endNum = parseInt(endHHMM, 10);
      const spansMidnight = endNum < startNum;

      // Check for days in preceding or same line
      const daysMatch = line.match(REGEX.scheduleDays);
      const days = daysMatch ? daysMatch.map((d) => d.toUpperCase()) : ["DLY"];

      schedules.push({
        days,
        startHHMM,
        endHHMM,
        spansMidnight,
        raw: trimmed,
      });
    }
  }

  return schedules;
}

// ============== CATEGORY DETECTION ==============

function detectTags(text: string): string[] {
  const tags: string[] = [];

  if (REGEX.runway.test(text)) tags.push("RWY");
  if (REGEX.ils.test(text)) tags.push("ILS");
  if (REGEX.lighting.test(text)) tags.push("LGT");
  if (REGEX.crane.test(text)) tags.push("OBST");
  if (REGEX.airspace.test(text)) tags.push("AIRSPACE");
  if (REGEX.nav.test(text)) tags.push("NAV");

  return tags;
}

// ============== NOTAM BLOCK PARSING ==============

interface RawNotamBlock {
  airport: string;
  lines: string[];
}

function segmentNotamBlocks(text: string): RawNotamBlock[] {
  const lines = text.split("\n");
  const blocks: RawNotamBlock[] = [];
  let currentAirport = "";
  let currentBlock: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for airport header
    const airportMatch = trimmed.match(REGEX.airportHeader);
    if (airportMatch && trimmed.length <= 30) {
      // Save previous block
      if (currentBlock.length > 0 && currentAirport) {
        blocks.push({ airport: currentAirport, lines: [...currentBlock] });
        currentBlock = [];
      }
      currentAirport = airportMatch[1];
      continue;
    }

    // Check for new NOTAM start
    const notamMatch = trimmed.match(REGEX.notamId);
    const aipMatch = trimmed.match(REGEX.aipSup);
    const aicMatch = trimmed.match(REGEX.aic);

    if (notamMatch || aipMatch || aicMatch) {
      // Save previous block
      if (currentBlock.length > 0 && currentAirport) {
        blocks.push({ airport: currentAirport, lines: [...currentBlock] });
      }
      currentBlock = [trimmed];
    } else if (currentBlock.length > 0) {
      currentBlock.push(trimmed);
    }
  }

  // Save last block
  if (currentBlock.length > 0 && currentAirport) {
    blocks.push({ airport: currentAirport, lines: currentBlock });
  }

  return blocks;
}

function parseNotamBlock(block: RawNotamBlock): NotamRecord {
  const firstLine = block.lines[0] || "";
  const warnings: string[] = [];

  // Determine ID and type
  let idRaw = "";
  let idType: "notam" | "aip_sup" | "aic" = "notam";

  const notamMatch = firstLine.match(REGEX.notamId);
  const aipMatch = firstLine.match(REGEX.aipSup);
  const aicMatch = firstLine.match(REGEX.aic);

  if (aipMatch) {
    idRaw = aipMatch[2];
    idType = "aip_sup";
  } else if (aicMatch) {
    idRaw = aicMatch[2];
    idType = "aic";
  } else if (notamMatch) {
    idRaw = notamMatch[1];
    idType = "notam";
  }

  // Parse validity
  const validity = parseValidity(block.lines);
  if (validity.endKind === "UNKNOWN") {
    warnings.push("Could not parse validity");
  }

  // Parse schedules
  const schedule = parseSchedules(block.lines);

  // Full text
  const text = block.lines.join("\n");

  // Detect tags
  const tags = detectTags(text);

  return {
    airport: block.airport,
    idRaw,
    idType,
    validity,
    schedule,
    text,
    tags,
    parseWarnings: warnings,
  };
}

// ============== ACTIVE-AT-TIME LOGIC ==============

function hhmmFromDate(d: Date): string {
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}${mm}`;
}

function isActiveBySchedule(schedule: Schedule, refTime: Date): boolean {
  const hhmm = hhmmFromDate(refTime);

  if (!schedule.spansMidnight) {
    return hhmm >= schedule.startHHMM && hhmm <= schedule.endHHMM;
  }

  // Spans midnight: active if >= start OR <= end
  return hhmm >= schedule.startHHMM || hhmm <= schedule.endHHMM;
}

function overlapsWindow(
  validity: Validity,
  windowStart: Date,
  windowEnd: Date
): boolean {
  const start = validity.startUtc ?? new Date(0);
  const end = validity.endUtc;

  // If no end date (UFN/PERM), check if starts before window end
  if (end === null) {
    return start < windowEnd;
  }

  // Standard overlap check
  return start < windowEnd && end > windowStart;
}

export interface TimeWindow {
  start: Date;
  end: Date;
  refTime: Date;
}

/**
 * Calculate time windows for DEP/DEST/ALTN
 * DEP: ETD-2h to ETD+1h
 * DEST: ETA-1h to ETA+2h
 * ALTN: ALTN_ETA-1h to ALTN_ETA+3h
 */
export function calculateWindows(flight: FlightTimes): {
  dep: TimeWindow;
  dest: TimeWindow;
  altn: Record<string, TimeWindow>;
} {
  const etd = flight.etdUtc;
  const eta = flight.etaUtc;

  return {
    dep: {
      start: new Date(etd.getTime() - 2 * 60 * 60 * 1000),
      end: new Date(etd.getTime() + 1 * 60 * 60 * 1000),
      refTime: etd,
    },
    dest: {
      start: new Date(eta.getTime() - 1 * 60 * 60 * 1000),
      end: new Date(eta.getTime() + 2 * 60 * 60 * 1000),
      refTime: eta,
    },
    altn: Object.fromEntries(
      Object.entries(flight.altnEtaUtc).map(([icao, altnEta]) => [
        icao,
        {
          start: new Date(altnEta.getTime() - 1 * 60 * 60 * 1000),
          end: new Date(altnEta.getTime() + 3 * 60 * 60 * 1000),
          refTime: altnEta,
        },
      ])
    ),
  };
}

function checkActive(
  notam: NotamRecord,
  targetAirport: string,
  window: TimeWindow
): ActiveStatus {
  // Different airport
  if (notam.airport !== targetAirport) {
    return { isActive: false, reason: "different airport" };
  }

  // Check validity overlap
  if (!overlapsWindow(notam.validity, window.start, window.end)) {
    return { isActive: false, reason: "outside validity window" };
  }

  // If no schedule, it's active within validity
  if (notam.schedule.length === 0) {
    return { isActive: true, reason: "within validity" };
  }

  // Check schedule at reference time
  const scheduleActive = notam.schedule.some((s) =>
    isActiveBySchedule(s, window.refTime)
  );

  if (scheduleActive) {
    return { isActive: true, reason: "within validity + schedule" };
  }

  return { isActive: false, reason: "outside schedule" };
}

// ============== MAIN PARSER ==============

export function parseNotamBulletin(
  bulletinText: string,
  flight: FlightTimes
): ParsedNotamBulletin {
  const globalWarnings: string[] = [];

  // Segment into blocks
  const blocks = segmentNotamBlocks(bulletinText);

  if (blocks.length === 0) {
    globalWarnings.push("No NOTAM blocks found in bulletin");
  }

  // Parse each block
  const notams = blocks.map(parseNotamBlock);

  // Calculate windows
  const windows = calculateWindows(flight);

  // Determine active status for each NOTAM
  const notamsWithStatus: NotamWithStatus[] = notams.map((notam) => ({
    ...notam,
    active: {
      dep: checkActive(notam, flight.dep, windows.dep),
      dest: checkActive(notam, flight.dest, windows.dest),
      altn: Object.fromEntries(
        flight.altn.map((icao) => [
          icao,
          checkActive(notam, icao, windows.altn[icao] || windows.dest),
        ])
      ),
    },
  }));

  return {
    source: "ofp_lido_bulletin",
    flight,
    notams: notamsWithStatus,
    parseWarnings: globalWarnings,
  };
}

// ============== FILTER HELPERS ==============

export function filterActiveNotams(
  parsed: ParsedNotamBulletin,
  phase: "dep" | "dest" | "altn",
  altnIcao?: string
): NotamWithStatus[] {
  return parsed.notams.filter((n) => {
    if (phase === "altn" && altnIcao) {
      return n.active.altn[altnIcao]?.isActive;
    }
    return n.active[phase]?.isActive;
  });
}

export function groupNotamsByAirport(
  notams: NotamWithStatus[]
): Record<string, NotamWithStatus[]> {
  const grouped: Record<string, NotamWithStatus[]> = {};

  for (const notam of notams) {
    if (!grouped[notam.airport]) {
      grouped[notam.airport] = [];
    }
    grouped[notam.airport].push(notam);
  }

  return grouped;
}

// ============== EXTRACT FLIGHT TIMES FROM OFP ==============

/**
 * Extract flight times from OFP text
 * Looks for patterns like:
 * - EOBT/ETD: "OMAA0135" in ATC FPL
 * - ETA: "LOWW0525" in ATC FPL
 * - Flight date from header
 */
export function extractFlightTimesFromOFP(ofpText: string): Partial<FlightTimes> | null {
  const result: Partial<FlightTimes> = {
    altn: [],
    altnEtaUtc: {},
  };

  // Extract date from header (e.g., "03Oct2025" or "03OCT25")
  const dateMatch = ofpText.match(/(\d{2})([A-Z]{3})(\d{2,4})/i);
  let flightDate: Date | null = null;

  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = MONTHS[dateMatch[2].toUpperCase()];
    let year = parseInt(dateMatch[3], 10);
    if (year < 100) year += 2000;

    if (month !== undefined) {
      flightDate = new Date(Date.UTC(year, month, day));
    }
  }

  // Extract DEP/DEST from FPL line (e.g., "-OMAA0135" and "LOWW0525")
  const fplMatch = ofpText.match(/-([A-Z]{4})(\d{4})\s+.*?([A-Z]{4})(\d{4})/);
  if (fplMatch && flightDate) {
    result.dep = fplMatch[1];
    const depHHMM = fplMatch[2];
    result.etdUtc = new Date(flightDate);
    result.etdUtc.setUTCHours(
      parseInt(depHHMM.substring(0, 2), 10),
      parseInt(depHHMM.substring(2, 4), 10)
    );

    result.dest = fplMatch[3];
    const destHHMM = fplMatch[4];
    result.etaUtc = new Date(flightDate);
    result.etaUtc.setUTCHours(
      parseInt(destHHMM.substring(0, 2), 10),
      parseInt(destHHMM.substring(2, 4), 10)
    );

    // Handle day rollover (if ETA < ETD, it's next day)
    if (result.etaUtc < result.etdUtc) {
      result.etaUtc.setUTCDate(result.etaUtc.getUTCDate() + 1);
    }
  }

  // Extract alternates (e.g., "ALTN LHBP" or "-LOWW0525 LHBP")
  const altnMatches = ofpText.matchAll(/(?:ALTN|ALTERNATE)[:\s]+([A-Z]{4})/gi);
  for (const match of altnMatches) {
    const altnIcao = match[1];
    if (!result.altn!.includes(altnIcao)) {
      result.altn!.push(altnIcao);
      // Default alternate ETA = destination ETA + 60 min
      if (result.etaUtc) {
        result.altnEtaUtc![altnIcao] = new Date(
          result.etaUtc.getTime() + 60 * 60 * 1000
        );
      }
    }
  }

  // Also check for alternate in FPL format
  const altnFplMatch = ofpText.match(/[A-Z]{4}\d{4}\s+([A-Z]{4})(?:\s|$)/);
  if (altnFplMatch) {
    const altnIcao = altnFplMatch[1];
    if (!result.altn!.includes(altnIcao)) {
      result.altn!.push(altnIcao);
      if (result.etaUtc) {
        result.altnEtaUtc![altnIcao] = new Date(
          result.etaUtc.getTime() + 60 * 60 * 1000
        );
      }
    }
  }

  if (!result.dep || !result.dest || !result.etdUtc || !result.etaUtc) {
    return null;
  }

  return result;
}
