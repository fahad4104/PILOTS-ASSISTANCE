"use client";

import React, { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

type Output = any;

// Helper to safely convert any value to a displayable string
function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(v => safeString(v)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Modal Component for showing raw NOTAM text
function NotamModal({
  isOpen,
  onClose,
  title,
  content
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-auto p-6 bg-gray-50">
          {content ? (
            <pre className="whitespace-pre-wrap rounded-xl bg-white border border-gray-200 p-5 font-mono text-base leading-relaxed text-gray-800 shadow-inner">
              {content}
            </pre>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No NOTAM data available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white transition-all hover:from-blue-700 hover:to-blue-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Enhanced Card Component with gradient border
function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-4 flex items-center gap-2">
          {icon && <span className="text-2xl">{icon}</span>}
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

// Enhanced KV Component with better styling
function KV({ k, v, highlight }: { k: string; v?: string | string[] | unknown; highlight?: boolean }) {
  // Safely convert value to string to prevent React rendering errors
  const displayValue = (() => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  })();

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      highlight
        ? "border-blue-200 bg-blue-50/50"
        : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
    }`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{k}</div>
      <div className={`mt-2 font-semibold ${highlight ? "text-blue-900 text-lg" : "text-gray-900"}`}>
        {displayValue.length ? displayValue : "—"}
      </div>
    </div>
  );
}

// NotamItem type for typed NOTAM data
type NotamItem = { text: string; rawText?: string; validFrom?: string; validTo?: string; isRelevant?: boolean } | string;

// Helper to get raw/original NOTAM text for modal display
function getRawNotamText(item: NotamItem): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object") {
    // Prefer rawText (original), fallback to text
    return item.rawText || item.text || "";
  }
  return String(item);
}

// Enhanced List Field with better visuals - supports both string[] and NotamItem[]
function ListField({
  label,
  items,
  type,
  onCardClick
}: {
  label: string;
  items?: NotamItem[];
  type?: "warning" | "info" | "default";
  onCardClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const safe = items || [];
  const shown = open ? safe : safe.slice(0, 5);

  // Helper to get text from item (handles both string and NotamItem)
  const getItemText = (item: NotamItem): string => {
    if (!item) return "";
    if (typeof item === "string") return item;
    if (typeof item === "object" && item.text) return item.text;
    return String(item);
  };

  const getIcon = () => {
    if (type === "warning") return "⚠️";
    if (type === "info") return "ℹ️";
    return "📋";
  };

  const getBorderColor = () => {
    if (type === "warning") return "border-amber-200 bg-amber-50/30";
    if (type === "info") return "border-blue-200 bg-blue-50/30";
    return "border-gray-200 bg-gray-50/50";
  };

  const isClickable = onCardClick && safe.length > 0;

  return (
    <div
      className={`rounded-xl border p-4 ${getBorderColor()} ${
        isClickable ? "cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-md" : ""
      }`}
      onClick={isClickable ? onCardClick : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{getIcon()}</span>
          <div className="text-sm font-semibold text-gray-700">{label}</div>
          {isClickable && (
            <span className="text-xs text-blue-600">👆</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            safe.length === 0
              ? "bg-green-100 text-green-700"
              : "bg-gray-200 text-gray-700"
          }`}>
            {safe.length}
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {shown.length ? (
          shown.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm leading-relaxed text-gray-700">
              <span className="mt-1 text-xs">•</span>
              <span className="flex-1">{getItemText(item)}</span>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>✓</span>
            <span>No items found</span>
          </div>
        )}
      </div>
      {safe.length > 5 && (
        <button
          className="mt-3 flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
          onClick={() => setOpen((s) => !s)}
        >
          {open ? "↑ Show less" : `↓ Show more (${safe.length - 5})`}
        </button>
      )}
    </div>
  );
}

// Weather Display Component
function WeatherCard({ title, taf, summary }: { title: string; taf: unknown; summary: unknown }) {
  // Safely convert to string to prevent React rendering errors
  const safeTaf = typeof taf === "string" ? taf : (taf ? String(taf) : "");
  const safeSummary = typeof summary === "string" ? summary : (summary ? String(summary) : "");

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">🌤️</span>
        <h4 className="font-semibold text-gray-900">{title}</h4>
      </div>
      {safeTaf ? (
        <>
          <div className="mb-3 rounded-lg bg-gray-900 p-3 font-mono text-xs text-green-400">
            {safeTaf}
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-semibold">Summary: </span>
            {safeSummary || "N/A"}
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500">No weather data available</div>
      )}
    </div>
  );
}

// Helper to get text from NotamItem
function getNotamText(item: NotamItem): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object" && item.text) return item.text;
  return "";
}

// Generate summary text for download
function generateSummaryText(data: Output): string {
  const lines: string[] = [];
  const divider = "═".repeat(50);

  lines.push(divider);
  lines.push("           FLIGHT BRIEF SUMMARY");
  lines.push(divider);
  lines.push("");

  // Flight Info
  lines.push(`Flight: ${data.flight?.flightNumber || "—"}`);
  lines.push(`Date: ${data.flight?.date || "—"}`);
  lines.push(`Route: ${data.flight?.departure || "—"} → ${data.flight?.destination || "—"}`);
  lines.push(`Aircraft: ${data.flight?.aircraft || "—"} (${data.flight?.registration || "—"})`);
  lines.push(`ETD: ${data.flight?.etd || "—"}  |  ETA: ${data.flight?.eta || "—"}`);
  lines.push("");

  // Runways
  lines.push("─".repeat(50));
  lines.push("RUNWAYS");
  lines.push(`DEP RWY: ${data.flight?.departureRunway || "—"}`);
  lines.push(`ARR RWY: ${data.flight?.arrivalRunway || "—"}`);
  lines.push(`Alternate: ${data.flight?.alternateAirport || "—"} (${data.flight?.alternateTime || "—"})`);
  lines.push("");

  // Fuel
  lines.push("─".repeat(50));
  lines.push("FUEL");
  lines.push(`Block Fuel: ${data.fuel?.blockFuel || "—"}`);
  lines.push(`Trip Fuel: ${data.fuel?.trip || "—"}`);
  lines.push(`Trip Time: ${data.fuel?.tripTime || "—"}`);
  lines.push("");

  // Destination NOTAMs
  lines.push("─".repeat(50));
  lines.push("DESTINATION NOTAMs");
  const destILS = data.notams?.destinationILS || [];
  const destRWY = data.notams?.destinationRunway || [];
  const destOther = data.notams?.destinationOther || [];

  if (destILS.length > 0) {
    lines.push("  ILS/Approach:");
    destILS.forEach((n: NotamItem) => lines.push(`    • ${getNotamText(n)}`));
  }
  if (destRWY.length > 0) {
    lines.push("  Runway:");
    destRWY.forEach((n: NotamItem) => lines.push(`    • ${getNotamText(n)}`));
  }
  if (destOther.length > 0) {
    lines.push("  Other:");
    destOther.forEach((n: NotamItem) => lines.push(`    • ${getNotamText(n)}`));
  }
  if (destILS.length === 0 && destRWY.length === 0 && destOther.length === 0) {
    lines.push("  ✓ No relevant NOTAMs");
  }
  lines.push("");

  // Alternate NOTAMs
  if (data.flight?.alternateAirport) {
    lines.push("─".repeat(50));
    lines.push(`ALTERNATE NOTAMs (${data.flight.alternateAirport})`);
    const altILS = data.notams?.alternateILS || [];
    const altRWY = data.notams?.alternateRunway || [];
    const altOther = data.notams?.alternateOther || [];

    if (altILS.length > 0) {
      lines.push("  ILS/Approach:");
      altILS.forEach((n: NotamItem) => lines.push(`    • ${getNotamText(n)}`));
    }
    if (altRWY.length > 0) {
      lines.push("  Runway:");
      altRWY.forEach((n: NotamItem) => lines.push(`    • ${getNotamText(n)}`));
    }
    if (altOther.length > 0) {
      lines.push("  Other:");
      altOther.forEach((n: NotamItem) => lines.push(`    • ${getNotamText(n)}`));
    }
    if (altILS.length === 0 && altRWY.length === 0 && altOther.length === 0) {
      lines.push("  ✓ No relevant NOTAMs");
    }
    lines.push("");
  }

  // Weather
  lines.push("─".repeat(50));
  lines.push("WEATHER");
  if (data.weather?.destinationTAF) {
    lines.push(`Destination TAF:`);
    lines.push(`  ${data.weather.destinationTAF}`);
  }
  if (data.weather?.alternateTAF) {
    lines.push(`Alternate TAF:`);
    lines.push(`  ${data.weather.alternateTAF}`);
  }
  lines.push("");

  lines.push(divider);
  lines.push(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`);
  lines.push(divider);

  return lines.join("\n");
}

export default function FlightPlanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [data, setData] = useState<Output | null>(null);

  // Modal state for raw NOTAM display
  const [notamModal, setNotamModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
  }>({ isOpen: false, title: "", content: "" });

  const openNotamModal = (title: string, content: string) => {
    setNotamModal({ isOpen: true, title, content });
  };

  const closeNotamModal = () => {
    setNotamModal({ isOpen: false, title: "", content: "" });
  };

  async function analyze() {
    setErr("");
    setData(null);

    if (!file) {
      setErr("Please select a PDF file first.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/flight-plan/analyze", { method: "POST", body: fd });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const t = await res.text();
        throw new Error(`Non-JSON response (${res.status}): ${t.slice(0, 180)}`);
      }

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      setData(json);
    } catch (e: any) {
      const errorMsg = e?.message || e;
      setErr(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-3">
            <span className="text-5xl">✈️</span>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Flight Plan Analyzer
            </h1>
          </div>
          <p className="text-gray-600">Upload your Etihad OFP (PDF) to extract key flight information</p>
        </div>

        {/* Upload Section */}
        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 shadow-sm transition-all hover:border-blue-400 hover:shadow-md">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl">📄</div>
            <div className="text-center">
              <div className="mb-2 text-lg font-semibold text-gray-900">Upload OFP</div>
              <div className="text-sm text-gray-500">
                {file ? (
                  <span className="text-blue-600 font-medium">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                ) : (
                  "Choose a PDF file or drag and drop"
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <label className="cursor-pointer rounded-xl bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-200">
                Choose File
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                onClick={analyze}
                disabled={loading || !file}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  "🔍 Analyze Flight Plan"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {err && (
          <div className="mb-8 rounded-2xl border-2 border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <div className="font-bold text-red-900">Error</div>
                <div className="mt-1 text-sm text-red-700">{err}</div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-6">
            {/* Extracted Flight Information Fields */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row">
              {/* Flight Number Field */}
              <div className="flex-1">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-700">
                  FLIGHT NUMBER
                </label>
                <div className="w-full rounded-lg border border-blue-200 bg-white px-4 py-3 text-base font-semibold text-blue-900">
                  {safeString(data.flight?.flightNumber) || "—"}
                </div>
              </div>

              {/* Date Field */}
              <div className="flex-1">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-700">
                  DATE
                </label>
                <div className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base font-semibold text-gray-900">
                  {safeString(data.flight?.date) || "—"}
                </div>
              </div>

              {/* Route Field */}
              <div className="flex-1">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-700">
                  ROUTE
                </label>
                <div className="relative">
                  <div className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-base font-semibold text-gray-900">
                    {data.flight?.departure && data.flight?.destination
                      ? `${safeString(data.flight.departure)} → ${safeString(data.flight.destination)}`
                      : "—"}
                  </div>
                  <svg
                    className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Flight Info - Highlighted */}
            <Card title="Flight Information" icon="✈️">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <KV k="Aircraft" v={`${data.flight?.aircraft} (${data.flight?.registration})`} />
                <KV k="Registration" v={data.flight?.registration} />
                <KV k="ETD" v={data.flight?.etd} />
                <KV k="ETA" v={data.flight?.eta} />
              </div>
            </Card>

            {/* Weights & Fuel - Two Column Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card title="Weights / Fuel / Levels" icon="⚖️">
                <div className="grid grid-cols-2 gap-3">
                  <KV k="MTOW" v={data.flight?.mtow} />
                  <KV k="ETOW" v={data.flight?.etow} />
                  <KV k="ELAW" v={data.flight?.elaw} />
                  <KV k="EZFW" v={data.flight?.ezfw} />
                  <KV k="EET (Trip)" v={data.flight?.flightTime} highlight />
                  <KV k="Block Fuel" v={data.fuel?.blockFuel} highlight />
                  <KV k="Trip Time" v={data.fuel?.tripTime} />
                  <KV k="Cruise Level" v={data.fuel?.dominantCruiseLevel || data.flight?.cruiseLevel} />
                </div>
              </Card>

              <Card title="Runways / Alternate" icon="🛬">
                <div className="space-y-3">
                  <KV k="Expected RWY DEP" v={data.flight?.departureRunway} />
                  <KV k="Expected RWY ARR" v={data.flight?.arrivalRunway} />
                  <KV k="Alternate Airport" v={data.flight?.alternateAirport} highlight />
                  <KV k="Alternate Time" v={data.flight?.alternateTime} />
                </div>
              </Card>
            </div>

            {/* Weather Section */}
            <Card title="Weather Information" icon="🌤️">
              <div className="space-y-4">
                <WeatherCard 
                  title="Destination Weather"
                  taf={data.weather?.destinationTAF}
                  summary={data.weather?.destinationSummary}
                />
                {data.weather?.alternateTAF && (
                  <WeatherCard 
                    title="Alternate Weather"
                    taf={data.weather?.alternateTAF}
                    summary={data.weather?.alternateSummary}
                  />
                )}
              </div>
            </Card>

            {/* NOTAMs - Organized by Category */}
            <Card title="Destination NOTAMs (Arrival-Relevant)" icon="📢">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ListField
                  label="ILS / Approach"
                  items={data.notams?.destinationILS}
                  type={data.notams?.destinationILS?.length > 0 ? "warning" : "default"}
                  onCardClick={() => {
                    const items = data.notams?.destinationILS || [];
                    const content = items.map((item: NotamItem) => getRawNotamText(item)).join("\n\n" + "─".repeat(40) + "\n\n");
                    openNotamModal("ILS / Approach NOTAMs", content);
                  }}
                />
                <ListField
                  label="Runway"
                  items={data.notams?.destinationRunway}
                  type={data.notams?.destinationRunway?.length > 0 ? "warning" : "default"}
                  onCardClick={() => {
                    const items = data.notams?.destinationRunway || [];
                    const content = items.map((item: NotamItem) => getRawNotamText(item)).join("\n\n" + "─".repeat(40) + "\n\n");
                    openNotamModal("Runway NOTAMs", content);
                  }}
                />
                <ListField
                  label="Other"
                  items={data.notams?.destinationOther}
                  type="info"
                  onCardClick={() => {
                    const items = data.notams?.destinationOther || [];
                    const content = items.map((item: NotamItem) => getRawNotamText(item)).join("\n\n" + "─".repeat(40) + "\n\n");
                    openNotamModal("Other NOTAMs", content);
                  }}
                />
              </div>
            </Card>

            {/* Alternate NOTAMs */}
            {data.flight?.alternateAirport && (
              <Card title={`Alternate NOTAMs - ${safeString(data.flight.alternateAirport)}`} icon="🔄">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ListField
                    label="ILS / Approach"
                    items={data.notams?.alternateILS}
                    type={data.notams?.alternateILS?.length > 0 ? "warning" : "default"}
                    onCardClick={() => {
                      const items = data.notams?.alternateILS || [];
                      const content = items.map((item: NotamItem) => getRawNotamText(item)).join("\n\n" + "─".repeat(40) + "\n\n");
                      openNotamModal("Alternate - ILS / Approach NOTAMs", content);
                    }}
                  />
                  <ListField
                    label="Runway"
                    items={data.notams?.alternateRunway}
                    type={data.notams?.alternateRunway?.length > 0 ? "warning" : "default"}
                    onCardClick={() => {
                      const items = data.notams?.alternateRunway || [];
                      const content = items.map((item: NotamItem) => getRawNotamText(item)).join("\n\n" + "─".repeat(40) + "\n\n");
                      openNotamModal("Alternate - Runway NOTAMs", content);
                    }}
                  />
                  <ListField
                    label="Other"
                    items={data.notams?.alternateOther}
                    type="info"
                    onCardClick={() => {
                      const items = data.notams?.alternateOther || [];
                      const content = items.map((item: NotamItem) => getRawNotamText(item)).join("\n\n" + "─".repeat(40) + "\n\n");
                      openNotamModal("Alternate - Other NOTAMs", content);
                    }}
                  />
                </div>
              </Card>
            )}

            {/* Download Summary Button */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const summary = generateSummaryText(data);
                  const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `FlightBrief_${data.flight?.flightNumber || "OFP"}_${data.flight?.date || "unknown"}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-green-600 to-green-700 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-green-800 hover:shadow-xl"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Flight Brief Summary
              </button>
            </div>

            {/* Parser Warnings (if any) */}
            {data.warnings && data.warnings.length > 0 && (
              <Card title="Parser Warnings" icon="⚠️">
                <div className="space-y-2 text-sm text-amber-700">
                  {data.warnings.map((w: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* NOTAM Modal */}
      <NotamModal
        isOpen={notamModal.isOpen}
        onClose={closeNotamModal}
        title={notamModal.title}
        content={notamModal.content}
      />
    </div>
    </ProtectedRoute>
  );
}
