"use client";

import React, { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

type Output = any;

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
        <div className="max-h-[60vh] overflow-auto p-6">
          {content ? (
            <pre className="whitespace-pre-wrap rounded-xl bg-gray-900 p-4 font-mono text-sm leading-relaxed text-green-400">
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
function KV({ k, v, highlight }: { k: string; v?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 transition-all ${
      highlight 
        ? "border-blue-200 bg-blue-50/50" 
        : "border-gray-200 bg-gray-50/50 hover:border-gray-300"
    }`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{k}</div>
      <div className={`mt-2 font-semibold ${highlight ? "text-blue-900 text-lg" : "text-gray-900"}`}>
        {v && v.length ? v : "—"}
      </div>
    </div>
  );
}

// NotamItem type for typed NOTAM data
type NotamItem = { text: string; validFrom?: string; validTo?: string; isRelevant?: boolean } | string;

// Enhanced List Field with better visuals - supports both string[] and NotamItem[]
function ListField({ label, items, type }: { label: string; items?: NotamItem[]; type?: "warning" | "info" | "default" }) {
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

  return (
    <div className={`rounded-xl border p-4 ${getBorderColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{getIcon()}</span>
          <div className="text-sm font-semibold text-gray-700">{label}</div>
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
function WeatherCard({ title, taf, summary }: { title: string; taf: string; summary: string }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">🌤️</span>
        <h4 className="font-semibold text-gray-900">{title}</h4>
      </div>
      {taf ? (
        <>
          <div className="mb-3 rounded-lg bg-gray-900 p-3 font-mono text-xs text-green-400">
            {taf}
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-semibold">Summary: </span>
            {summary || "N/A"}
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500">No weather data available</div>
      )}
    </div>
  );
}

// Wind Shear Table Component
function WindShearTable({ points }: { points: any[] }) {
  if (!points || points.length === 0) {
    return (
      <div className="text-center text-sm text-gray-500 py-4">
        No explicit turbulence/windshear section found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full">
        <thead className="bg-gradient-to-r from-red-600 to-red-700 text-white">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold">Waypoint</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Time (UTC)</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Level</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">Shear Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {points.map((point, idx) => (
            <tr key={idx} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono font-semibold text-gray-900">{point.waypoint}</td>
              <td className="px-4 py-3 font-mono text-gray-700">{point.time}</td>
              <td className="px-4 py-3 font-mono text-gray-700">{point.level}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 font-bold ${
                  point.shearRate >= 8 
                    ? "bg-red-100 text-red-700" 
                    : point.shearRate >= 7 
                    ? "bg-orange-100 text-orange-700" 
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {point.shearRate}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
      setErr(String(e?.message || e));
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
                  {data.flight?.flightNumber || "—"}
                </div>
              </div>

              {/* Date Field */}
              <div className="flex-1">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-700">
                  DATE
                </label>
                <div className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base font-semibold text-gray-900">
                  {data.flight?.date || "—"}
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
                      ? `${data.flight.departure} → ${data.flight.destination}` 
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
            <div
              onClick={() => openNotamModal("Destination NOTAMs - Original Text", data.notams?.rawDestinationNotams || "")}
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <Card title="Destination NOTAMs (Arrival-Relevant)" icon="📢">
                <div className="mb-3 text-xs text-blue-600 font-medium">
                  👆 Click to view original NOTAM text
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ListField
                    label="ILS / Approach"
                    items={data.notams?.destinationILS}
                    type={data.notams?.destinationILS?.length > 0 ? "warning" : "default"}
                  />
                  <ListField
                    label="Runway"
                    items={data.notams?.destinationRunway}
                    type={data.notams?.destinationRunway?.length > 0 ? "warning" : "default"}
                  />
                  <ListField
                    label="Other"
                    items={data.notams?.destinationOther}
                    type="info"
                  />
                </div>
              </Card>
            </div>

            {/* Alternate NOTAMs */}
            {data.flight?.alternateAirport && (
              <div
                onClick={() => openNotamModal("Alternate NOTAMs - Original Text", data.notams?.rawAlternateNotams || "")}
                className="cursor-pointer transition-transform hover:scale-[1.01]"
              >
                <Card title="Alternate NOTAMs (Arrival-Relevant)" icon="🔄">
                  <div className="mb-3 text-xs text-blue-600 font-medium">
                    👆 Click to view original NOTAM text
                  </div>
                  <div className="mb-4">
                    <KV k="Alternate Airport" v={data.flight.alternateAirport} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ListField
                      label="ILS / Approach"
                      items={data.notams?.alternateILS}
                      type={data.notams?.alternateILS?.length > 0 ? "warning" : "default"}
                    />
                    <ListField
                      label="Runway"
                      items={data.notams?.alternateRunway}
                      type={data.notams?.alternateRunway?.length > 0 ? "warning" : "default"}
                    />
                    <ListField
                      label="Other"
                      items={data.notams?.alternateOther}
                      type="info"
                    />
                  </div>
                </Card>
              </div>
            )}

            {/* Wind Shear */}
            <Card title="Wind Shear / Turbulence (High Rate Areas)" icon="💨">
              <WindShearTable points={data.windShear} />
              {data.windShear && data.windShear.length > 0 && (
                <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <strong>Note:</strong> High wind shear areas detected. Review turbulence procedures.
                </div>
              )}
            </Card>

            {/* MORA */}
            {data.mora && data.mora.length > 0 && (
              <Card title="MORA Segments > 10,000 ft" icon="⛰️">
                <div className="space-y-2">
                  {data.mora.map((seg: any, idx: number) => (
                    <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                      <span className="font-mono font-semibold text-gray-900">{seg.segment}</span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="font-semibold text-red-600">{seg.altitude} ft</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  <strong>Note:</strong> Emergency escape brief may be required for segments above 10,000 ft.
                </div>
              </Card>
            )}

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
