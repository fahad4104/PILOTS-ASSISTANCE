// src/lib/lidoNotam.ts
/* Deterministic LIDO NOTAM bulletin parser + active-at-time filtering.
   Works on text extracted from OFP PDFs (Lido Flight Planning style).
*/

export type HHMM = `${number}${number}${number}${number}`;

export type FlightTimesUTC = {
  offBlockUtc?: Date;   // DEP reference
  takeoffUtc?: Date;
  landingUtc?: Date;    // DEST reference
  inUtc?: Date;
};

export type AirportRefTimes = {
  dep: { icao: string; refUtc: Date; windowStartUtc: Date; windowEndUtc: Date };
  dest: { icao: string; refUtc: Date; windowStartUtc: Date; windowEndUtc: Date };
  altn?: Array<{ icao: string; refUtc: Date; windowStartUtc: Date; windowEndUtc: Date }>;
};

export type Validity = {
  startUtc: Date | null;
  endUtc: Date | null; // null = open ended (UFN/PERM)
  endKind?: "UFN" | "PERM" | "UNKNOWN";
  raw?: string;
};

export type Schedule = {
  // MVP: time-of-day only, optional day qualifiers (kept raw)
  startHHMM: HHMM;
  endHHMM: HHMM;
  spansMidnight: boolean;
  raw: string;
};

export type NotamRecord = {
  airport: string;          // inferred from airport section header
  idRaw: string;            // e.g., 1A455/26 OR SX0079/25
  idType: "notam" | "aip_sup" | "aic" | "unknown";
  text: string;             // full block text
  validity: Validity;        // best-effort parsed
  schedules: Schedule[];     // zero or more
  parseWarnings: string[];
};

export type ActiveResult = {
  record: NotamRecord;
  depActive?: boolean;
  destActive?: boolean;
  altnActive?: Record<string, boolean>;
  reasons: string[];
};

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function hhmmFromUtc(d: Date): HHMM {
  return `${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}` as HHMM;
}

/** Parse LIDO time token like "0940Z" or "0940Z/1140L" -> HHMM in Z */
function parseHHMMZ(token: string): HHMM | null {
  const m = token.match(/(\d{4})Z\b/);
  if (!m) return null;
  return m[1] as HHMM;
}

/** Build a UTC Date given a base date (YYYY-MM-DD) and HHMM */
function dateWithHHMM(baseDateUtc: Date, hhmm: HHMM): Date {
  const y = baseDateUtc.getUTCFullYear();
  const mo = baseDateUtc.getUTCMonth();
  const da = baseDateUtc.getUTCDate();
  const hh = Number(hhmm.slice(0, 2));
  const mm = Number(hhmm.slice(2, 4));
  return new Date(Date.UTC(y, mo, da, hh, mm, 0, 0));
}

/** Parse a LIDO date like "6FEB25" or "26JUN25" -> UTC Date at 00:00 */
function parseDMonYY(dmonyy: string): Date | null {
  const m = dmonyy.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS[m[2]];
  const yy = Number(m[3]);
  if (mon === undefined) return null;
  const year = 2000 + yy; // good for your use (2025/2026)
  return new Date(Date.UTC(year, mon, day, 0, 0, 0, 0));
}

/** Parse a LIDO datetime like "01-FEB-26 1130" -> UTC Date */
function parseDDMonYY_HHMM(s: string): Date | null {
  const m = s.match(/^(\d{2})-([A-Z]{3})-(\d{2})\s+(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS[m[2]];
  const yy = Number(m[3]);
  const hhmm = m[4] as HHMM;
  if (mon === undefined) return null;
  const year = 2000 + yy;
  const hh = Number(hhmm.slice(0, 2));
  const mm = Number(hhmm.slice(2, 4));
  return new Date(Date.UTC(year, mon, day, hh, mm, 0, 0));
}

/** Extract base flight date from header like "EY 0154/04Oct25/VIE-AUH" */
export function extractFlightDateUTC(ofpText: string): Date | null {
  const m = ofpText.match(/EY\s+\d+\/(\d{2})([A-Z][a-z]{2})(\d{2})\//);
  if (!m) return null;
  const day = Number(m[1]);
  const mon3 = m[2].toUpperCase(); // OCT
  const yy = Number(m[3]);
  const mon = MONTHS[mon3];
  if (mon === undefined) return null;
  const year = 2000 + yy;
  return new Date(Date.UTC(year, mon, day, 0, 0, 0, 0));
}

/** Extract DEP/DEST ICAO from route header like "LOWW/VIE OMAA/AUH" */
export function extractDepDestICAO(ofpText: string): { dep?: string; dest?: string } {
  const m = ofpText.match(/\b([A-Z]{4})\/[A-Z]{3}\s+([A-Z]{4})\/[A-Z]{3}\b/);
  if (!m) return {};
  return { dep: m[1], dest: m[2] };
}

/** Parse TIMES block (OFF BLOCK, TAKEOFF, LANDING, IN) from OFP text */
export function extractTimesFromOFP(ofpText: string): FlightTimesUTC {
  // We look for the TIMES section lines; we only need the first HHMMZ on each line.
  const out: FlightTimesUTC = {};
  const lines = ofpText.split(/\r?\n/);

  for (const line of lines) {
    if (line.includes("OFF BLOCK")) {
      const hhmm = parseHHMMZ(line);
      if (hhmm) out.offBlockUtc = { __hhmm: hhmm } as any;
    } else if (line.includes("TAKEOFF")) {
      const hhmm = parseHHMMZ(line);
      if (hhmm) out.takeoffUtc = { __hhmm: hhmm } as any;
    } else if (line.includes("LANDING")) {
      const hhmm = parseHHMMZ(line);
      if (hhmm) out.landingUtc = { __hhmm: hhmm } as any;
    } else if (line.match(/^\s*IN\s+/)) {
      const hhmm = parseHHMMZ(line);
      if (hhmm) out.inUtc = { __hhmm: hhmm } as any;
    }
  }

  return out;
}

/** Convert "placeholder" HHMM objects into real Date using baseDateUtc.
    Also handles crossing midnight for landing/in when needed.
*/
export function materializeTimes(baseDateUtc: Date, t: FlightTimesUTC): FlightTimesUTC {
  const toDate = (v?: any): Date | undefined => {
    if (!v?.__hhmm) return undefined;
    return dateWithHHMM(baseDateUtc, v.__hhmm as HHMM);
  };

  let off = toDate(t.offBlockUtc as any);
  let take = toDate(t.takeoffUtc as any);
  let land = toDate(t.landingUtc as any);
  let inn = toDate(t.inUtc as any);

  // Fix day rollovers: if landing is "earlier" than offBlock, assume next day
  if (off && land && land.getTime() < off.getTime()) land = addMinutes(land, 24 * 60);
  if (off && inn && inn.getTime() < off.getTime()) inn = addMinutes(inn, 24 * 60);
  if (off && take && take.getTime() < off.getTime()) take = addMinutes(take, 24 * 60);

  return { offBlockUtc: off, takeoffUtc: take, landingUtc: land, inUtc: inn };
}

/** Extract NOTAM bulletin text section */
export function extractLidoNotamBulletin(ofpText: string): string | null {
  const idx = ofpText.indexOf("LIDO-NOTAM-BULLETIN");
  if (idx === -1) return null;
  const sub = ofpText.slice(idx);

  // Stop at next big section markers (best-effort)
  const stopMarkers = [
    "\nATC FPL",
    "\nATC FLIGHT PLAN",
    "\nFLIGHT DESTINATION LOG",
    "\nEET",
    "\nPERFORMANCE DATA",
    "\nRVSM ALT CHECK",
    "\nFUEL STATISTICS",
  ];

  let end = sub.length;
  for (const m of stopMarkers) {
    const j = sub.indexOf(m);
    if (j !== -1 && j > 0) end = Math.min(end, j);
  }

  return sub.slice(0, end);
}

/** Parse NOTAM bulletin into records by airport sections and NOTAM blocks */
export function parseLidoNotams(bulletinText: string): NotamRecord[] {
  const lines = bulletinText.split(/\r?\n/);

  // Airport header heuristic: line equals "OMAA" or starts with "OMAA "
  const airportHeader = (s: string) => {
    const m = s.trim().match(/^([A-Z]{4})(?:\s|$)/);
    return m ? m[1] : null;
  };

  // Start-of-record: 1A455/26 OR AIP SUP SX0079/25 OR AIC AX0002/24
  const isStart = (s: string) => {
    const t = s.trim();
    if (/^(AIP\s+SUP)\b/.test(t)) return true;
    if (/^(AIC)\b/.test(t)) return true;
    if (/^[A-Z0-9]{1,3}\d{1,5}\/\d{2}\b/.test(t)) return true;
    return false;
  };

  let currentAirport: string | null = null;
  const chunks: Array<{ airport: string; text: string }> = [];

  let buf: string[] = [];
  let bufAirport: string | null = null;

  const flush = () => {
    if (bufAirport && buf.length) {
      chunks.push({ airport: bufAirport, text: buf.join("\n").trim() });
    }
    buf = [];
    bufAirport = null;
  };

  for (const line of lines) {
    const ap = airportHeader(line);
    if (ap && ["LIDO", "VALID", "VALIDITY"].every(x => ap !== x)) {
      // airport section changes
      currentAirport = ap;
      continue;
    }

    if (!currentAirport) continue;

    if (isStart(line)) {
      flush();
      bufAirport = currentAirport;
      buf.push(line);
    } else {
      if (bufAirport) buf.push(line);
    }
  }
  flush();

  return chunks.map(c => parseNotamBlock(c.airport, c.text));
}

function parseNotamBlock(airport: string, blockText: string): NotamRecord {
  const parseWarnings: string[] = [];
  const t = blockText.trim();

  // id + type
  let idRaw = "UNKNOWN";
  let idType: NotamRecord["idType"] = "unknown";

  const mSup = t.match(/^AIP\s+SUP\s+([A-Z]{1,3}\d{3,5}\/\d{2})\b/m);
  const mAic = t.match(/^AIC\s+([A-Z]{1,3}\d{3,5}\/\d{2})\b/m);
  const mNotam = t.match(/^([A-Z0-9]{1,3}\d{1,5}\/\d{2})\b/m);

  if (mSup) { idRaw = mSup[1]; idType = "aip_sup"; }
  else if (mAic) { idRaw = mAic[1]; idType = "aic"; }
  else if (mNotam) { idRaw = mNotam[1]; idType = "notam"; }
  else parseWarnings.push("Could not detect NOTAM id.");

  // validity
  const validity: Validity = { startUtc: null, endUtc: null, endKind: "UNKNOWN", raw: undefined };

  // Pattern: VALIDITY: 6FEB25 TILL UFN
  const r1 = t.match(/^VALIDITY:\s*(\d{1,2}[A-Z]{3}\d{2})\s+TILL\s+(UFN|PERM)\s*$/m);
  if (r1) {
    validity.startUtc = parseDMonYY(r1[1]);
    validity.endUtc = null;
    validity.endKind = r1[2] as any;
    validity.raw = r1[0].trim();
    if (!validity.startUtc) parseWarnings.push("Could not parse VALIDITY start date (TILL).");
  }

  // Pattern: VALIDITY: 26JUN25 - UFN
  const r2 = t.match(/^VALIDITY:\s*(\d{1,2}[A-Z]{3}\d{2})\s*-\s*(UFN|PERM)\s*$/m);
  if (!r1 && r2) {
    validity.startUtc = parseDMonYY(r2[1]);
    validity.endUtc = null;
    validity.endKind = r2[2] as any;
    validity.raw = r2[0].trim();
    if (!validity.startUtc) parseWarnings.push("Could not parse VALIDITY start date (dash).");
  }

  // Pattern: 01-FEB-26 1130 - 28-FEB-26 1430
  const r3 = t.match(/(\d{2}-[A-Z]{3}-\d{2}\s+\d{4})\s*-\s*(\d{2}-[A-Z]{3}-\d{2}\s+\d{4})/m);
  if (!r1 && !r2 && r3) {
    const s = parseDDMonYY_HHMM(r3[1]);
    const e = parseDDMonYY_HHMM(r3[2]);
    validity.startUtc = s;
    validity.endUtc = e;
    validity.endKind = "UNKNOWN";
    validity.raw = r3[0].trim();
    if (!s || !e) parseWarnings.push("Could not parse DD-MON-YY HHMM validity range.");
  }

  if (!validity.raw) {
    // If we didn't parse validity at all, keep open but warn
    parseWarnings.push("Validity not found in block (kept as unknown).");
  }

  // schedules: lines like 1500-0230
  const schedules: Schedule[] = [];
  const schedLines = t.split(/\r?\n/).map(x => x.trim()).filter(x => /^\d{4}\s*-\s*\d{4}$/.test(x));
  for (const sl of schedLines) {
    const m = sl.match(/^(\d{4})\s*-\s*(\d{4})$/);
    if (!m) continue;
    const start = m[1] as HHMM;
    const end = m[2] as HHMM;
    const spansMidnight = end < start;
    schedules.push({ startHHMM: start, endHHMM: end, spansMidnight, raw: sl });
  }

  return { airport, idRaw, idType, text: t, validity, schedules, parseWarnings };
}

/** Build windows around ref times (UTC) */
export function buildAirportRefTimes(args: {
  depIcao: string;
  destIcao: string;
  altIcaos?: string[];
  offBlockUtc: Date;
  landingUtc: Date;
  altnBufferMinutes?: number; // default +60
}): AirportRefTimes {
  const altnBuf = args.altnBufferMinutes ?? 60;

  const depRef = args.offBlockUtc;
  const destRef = args.landingUtc;

  const dep = {
    icao: args.depIcao,
    refUtc: depRef,
    windowStartUtc: addMinutes(depRef, -120),
    windowEndUtc: addMinutes(depRef, +60),
  };

  const dest = {
    icao: args.destIcao,
    refUtc: destRef,
    windowStartUtc: addMinutes(destRef, -60),
    windowEndUtc: addMinutes(destRef, +120),
  };

  const altn = (args.altIcaos ?? []).map((a) => {
    const ref = addMinutes(destRef, altnBuf);
    return {
      icao: a,
      refUtc: ref,
      windowStartUtc: addMinutes(ref, -60),
      windowEndUtc: addMinutes(ref, +180),
    };
  });

  return { dep, dest, altn: altn.length ? altn : undefined };
}

function overlaps(valid: Validity, wStart: Date, wEnd: Date): boolean {
  const s = valid.startUtc ?? new Date(0);
  const e = valid.endUtc; // null = infinity
  if (e === null) return s < wEnd;
  return s < wEnd && e > wStart;
}

function scheduleAllowsAt(s: Schedule, refUtc: Date): boolean {
  const hhmm = hhmmFromUtc(refUtc);
  if (!s.spansMidnight) return hhmm >= s.startHHMM && hhmm <= s.endHHMM;
  return hhmm >= s.startHHMM || hhmm <= s.endHHMM;
}

/** Decide if NOTAM is relevant (active) for a given airport/time window */
function isActiveFor(
  r: NotamRecord,
  airport: string,
  refUtc: Date,
  wStart: Date,
  wEnd: Date
): { ok: boolean; reason: string } {
  if (r.airport !== airport) return { ok: false, reason: "different airport" };

  // If validity unknown, we DON'T hide it. We surface it as potentially relevant.
  const validityKnown = Boolean(r.validity.raw && r.validity.startUtc);
  if (validityKnown) {
    if (!overlaps(r.validity, wStart, wEnd)) return { ok: false, reason: "outside validity window" };
  } else {
    // keep (safety)
    return { ok: true, reason: "validity unknown -> kept" };
  }

  // schedule handling: MVP = require schedule active at ref time if schedule exists
  if (r.schedules.length === 0) return { ok: true, reason: "validity overlap" };

  const ok = r.schedules.some(s => scheduleAllowsAt(s, refUtc));
  return { ok, reason: ok ? "validity+schedule" : "schedule not active at ref" };
}

/** Filter records into active sets for dep/dest/altn */
export function filterActiveNotams(records: NotamRecord[], refs: AirportRefTimes): ActiveResult[] {
  return records.map((r) => {
    const reasons: string[] = [];
    const dep = isActiveFor(r, refs.dep.icao, refs.dep.refUtc, refs.dep.windowStartUtc, refs.dep.windowEndUtc);
    const dest = isActiveFor(r, refs.dest.icao, refs.dest.refUtc, refs.dest.windowStartUtc, refs.dest.windowEndUtc);

    const altnActive: Record<string, boolean> = {};
    if (refs.altn) {
      for (const a of refs.altn) {
        const res = isActiveFor(r, a.icao, a.refUtc, a.windowStartUtc, a.windowEndUtc);
        altnActive[a.icao] = res.ok;
      }
    }

    if (dep.ok) reasons.push(`DEP: ${dep.reason}`);
    if (dest.ok) reasons.push(`DEST: ${dest.reason}`);
    if (refs.altn) {
      for (const a of refs.altn) {
        if (altnActive[a.icao]) reasons.push(`ALTN ${a.icao}: ok`);
      }
    }

    return {
      record: r,
      depActive: dep.ok,
      destActive: dest.ok,
      altnActive: refs.altn ? altnActive : undefined,
      reasons,
    };
  });
}
