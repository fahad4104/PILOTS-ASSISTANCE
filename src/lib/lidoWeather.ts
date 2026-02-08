// src/lib/lidoWeather.ts
// Deterministic LIDO OFP weather parser (DEP/ARR/ALTN).
// Input: full OFP text extracted from PDF.
// Output: structured weather blocks with raw + best-effort METAR/TAF extraction.

export type WeatherKind = "DEP" | "ARR" | "ALTN";

export type WeatherBlock = {
  kind: WeatherKind;
  icao: string;              // e.g., OMAA, RPLL
  name?: string;             // optional (if present in header)
  raw: string;               // full block raw text
  metar?: string;            // best-effort
  taf?: string;              // best-effort
  remarks?: string[];        // any extra lines not classified
  parseWarnings: string[];
};

const HEADER_PATTERNS: Array<{ kind: WeatherKind; re: RegExp }> = [
  { kind: "DEP",  re: /^\s*DEPARTURE\s+AIRPORT:\s*$/m },
  { kind: "ARR",  re: /^\s*ARRIVAL\s+AIRPORT:\s*$/m },
  { kind: "ALTN", re: /^\s*ALTERNATE\s+AIRPORT:\s*$/m },
  // Some LIDO variants:
  { kind: "ALTN", re: /^\s*ALTN\s+AIRPORT:\s*$/m },
  { kind: "ALTN", re: /^\s*ALTERNATE\(S\)\s+AIRPORT:\s*$/m },
];

// We stop WX blocks when we hit a new major section.
// Add markers as you encounter them in your OFPs.
const STOP_MARKERS = [
  "LIDO-NOTAM-BULLETIN",
  "ATC FPL",
  "ATC FLIGHT PLAN",
  "OPERATIONAL FLIGHT PLAN",
  "ROUTE",
  "FUEL",
  "ETOPS",
  "EET",
  "PERFORMANCE",
  "NOTAM",
  "SIGWX",
  "WIND/TEMP",
  "WINDS/TEMPS",
  "RVSM",
];

function indexOfAny(hay: string, needles: string[], fromIndex: number): number {
  let best = -1;
  for (const n of needles) {
    const i = hay.indexOf(n, fromIndex);
    if (i !== -1 && (best === -1 || i < best)) best = i;
  }
  return best;
}

/** Extracts all WX blocks for DEP/ARR/ALTN from the OFP text. */
export function extractWeatherBlocks(ofpText: string): WeatherBlock[] {
  const out: WeatherBlock[] = [];

  // Find all header occurrences
  type Hit = { kind: WeatherKind; idx: number; headerLen: number };
  const hits: Hit[] = [];

  for (const hp of HEADER_PATTERNS) {
    let m: RegExpExecArray | null;
    const re = new RegExp(hp.re.source, hp.re.flags.includes("g") ? hp.re.flags : hp.re.flags + "g");
    while ((m = re.exec(ofpText)) !== null) {
      hits.push({ kind: hp.kind, idx: m.index, headerLen: m[0].length });
    }
  }

  if (hits.length === 0) return out;

  hits.sort((a, b) => a.idx - b.idx);

  for (let k = 0; k < hits.length; k++) {
    const h = hits[k];
    const start = h.idx + h.headerLen;

    // End is either next WX header or next major section marker, whichever comes first.
    const nextHeaderIdx = (k + 1 < hits.length) ? hits[k + 1].idx : -1;
    const nextMarkerIdx = indexOfAny(ofpText, STOP_MARKERS, start);

    let end = ofpText.length;
    if (nextHeaderIdx !== -1) end = Math.min(end, nextHeaderIdx);
    if (nextMarkerIdx !== -1) end = Math.min(end, nextMarkerIdx);

    const rawBlock = ofpText.slice(start, end).trim();
    if (!rawBlock) continue;

    const parsed = parseSingleWeatherBlock(h.kind, rawBlock);
    out.push(parsed);
  }

  return out;
}

/** Parse one WX block body: first line should usually contain "ICAO/IATA NAME ..." */
export function parseSingleWeatherBlock(kind: WeatherKind, rawBody: string): WeatherBlock {
  const parseWarnings: string[] = [];
  const lines = rawBody.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Typical first line: "RPLL/MNL MANILA"
  // Sometimes: "OMAA/AUH ABU DHABI INTL"
  let icao = "UNKN";
  let name: string | undefined;

  if (lines.length > 0) {
    const m = lines[0].match(/^([A-Z]{4})\/[A-Z0-9]{3}\s*(.*)$/);
    if (m) {
      icao = m[1];
      name = m[2]?.trim() || undefined;
      lines.shift(); // remove header line from content lines
    } else {
      // Sometimes just ICAO on first line
      const m2 = lines[0].match(/^([A-Z]{4})\b\s*(.*)$/);
      if (m2) {
        icao = m2[1];
        name = m2[2]?.trim() || undefined;
        lines.shift();
      } else {
        parseWarnings.push("Could not parse airport identifier line in WX block.");
      }
    }
  }

  // Classify lines into METAR / TAF / other.
  // LIDO usually includes tokens like "METAR", "TAF", or starts with ICAO + time groups.
  const metarLines: string[] = [];
  const tafLines: string[] = [];
  const other: string[] = [];

  // Helper: detect start of METAR/TAF lines even if label is missing.
  const looksLikeMetar = (s: string) =>
    /\bMETAR\b/.test(s) ||
    new RegExp(`^${icao}\\s+\\d{6}Z\\b`).test(s) || // ICAO 011200Z ...
    /\bAUTO\b/.test(s) ||
    /\bQ\d{4}\b/.test(s);

  const looksLikeTaf = (s: string) =>
    /\bTAF\b/.test(s) ||
    /\bTAF\s+AMD\b/.test(s) ||
    /\bBECMG\b|\bTEMPO\b|\bFM\d{4}\b|\bPROB\d{2}\b/.test(s);

  // Many OFPs put METAR then TAF; sometimes multi-line TAF.
  let mode: "METAR" | "TAF" | "OTHER" = "OTHER";

  for (const line of lines) {
    const u = line.toUpperCase();

    // Explicit labels take priority
    if (u.startsWith("METAR ")) mode = "METAR";
    if (u.startsWith("SPECI ")) mode = "METAR";
    if (u.startsWith("TAF ")) mode = "TAF";
    if (u.startsWith("TAF AMD")) mode = "TAF";

    // Heuristic switch if label absent
    if (mode === "OTHER") {
      if (looksLikeMetar(u)) mode = "METAR";
      else if (looksLikeTaf(u)) mode = "TAF";
    } else if (mode === "METAR") {
      // If we see strong TAF tokens, switch to TAF
      if (looksLikeTaf(u) && !/\bMETAR\b/.test(u)) mode = "TAF";
    }

    if (mode === "METAR") metarLines.push(line);
    else if (mode === "TAF") tafLines.push(line);
    else other.push(line);
  }

  const metar = metarLines.length ? cleanupWxText(metarLines.join(" ")) : undefined;
  const taf = tafLines.length ? cleanupWxText(tafLines.join(" ")) : undefined;

  // If nothing detected, keep raw lines in remarks
  if (!metar && !taf) parseWarnings.push("No METAR/TAF detected (kept as raw).");

  return {
    kind,
    icao,
    name,
    raw: rawBody,
    metar,
    taf,
    remarks: other.length ? other : undefined,
    parseWarnings,
  };
}

function cleanupWxText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/(\bMETAR\b|\bTAF\b)\s+\1\b/g, "$1")
    .trim();
}
