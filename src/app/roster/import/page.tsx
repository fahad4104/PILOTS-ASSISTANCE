"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";

type Flight = {
  id: string;
  date: string;
  flightNumber: string;
  departure: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  aircraft: string;
  status: "scheduled" | "completed" | "cancelled";
  coPilot?: string;
};

export default function ImportRosterPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [previewData, setPreviewData] = useState<Flight[]>([]);
  const [showAutoSync, setShowAutoSync] = useState(false);
  const [ecrewEmployeeId, setEcrewEmployeeId] = useState("");
  const [ecrewPassword, setEcrewPassword] = useState("");
  const [showEcrewPassword, setShowEcrewPassword] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file type
      const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileType !== 'csv' && fileType !== 'xlsx' && fileType !== 'xls') {
        setError("Please upload a CSV or Excel file");
        return;
      }
      setFile(selectedFile);
      setError("");
    }
  };

  const parseCSV = (text: string): Flight[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const flights: Flight[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

      if (values.length >= 8) {
        flights.push({
          id: Date.now().toString() + i,
          date: values[0] || '',
          flightNumber: values[1] || '',
          departure: values[2] || '',
          destination: values[3] || '',
          departureTime: values[4] || '',
          arrivalTime: values[5] || '',
          aircraft: values[6] || '',
          coPilot: values[7] || '',
          status: 'scheduled'
        });
      }
    }

    return flights;
  };

  const handleImport = async () => {
    if (!file || !user) {
      setError("Please select a file and ensure you're logged in");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const text = await file.text();
      const flights = parseCSV(text);

      if (flights.length === 0) {
        setError("No valid flight data found in file");
        setLoading(false);
        return;
      }

      // Preview the data
      setPreviewData(flights);
      setSuccess(true);

    } catch (err: any) {
      setError("Failed to parse file: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSync = async () => {
    if (!user || !ecrewEmployeeId || !ecrewPassword) {
      setError("Please provide eCrew credentials");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch('/api/ecrew/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          ecrewEmployeeId,
          ecrewPassword,
        }),
      });

      const data = await response.json();

      if (data.success && data.flights) {
        setPreviewData(data.flights);
        setSuccess(true);
        setShowAutoSync(false);
      } else if (data.scrapedFlights && data.scrapedFlights.length > 0) {
        // DB save failed but we have scraped data - show it for debugging
        setPreviewData(data.scrapedFlights);
        setError(`${data.error}: ${data.details || 'Unknown error'}. Showing scraped data below.`);
        setSuccess(true);
      } else {
        setError(data.error || data.message || 'Failed to sync with eCrew');
      }
    } catch (err: any) {
      setError('Failed to sync: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const response = await fetch('/api/flights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          flights: previewData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to roster page
        router.push('/roster');
      } else {
        setError('Failed to save flights: ' + (data.error || 'Unknown error'));
        setLoading(false);
      }
    } catch (err: any) {
      setError('Failed to save flights: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/roster" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
              <span>←</span>
              <span>Back to Roster</span>
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-5xl">📥</span>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Import Roster
              </h1>
            </div>
            <p className="text-gray-600">Upload your eCrew roster file (CSV or Excel)</p>
          </div>

          {/* Import Method Selection */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowAutoSync(false)}
              className={`rounded-2xl border-2 p-6 text-left transition-all ${
                !showAutoSync
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">📄</span>
                <h3 className="font-bold text-gray-900">Manual Upload</h3>
              </div>
              <p className="text-sm text-gray-600">
                Export CSV from eCrew and upload it here
              </p>
            </button>

            <button
              onClick={() => setShowAutoSync(true)}
              className={`rounded-2xl border-2 p-6 text-left transition-all ${
                showAutoSync
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🔄</span>
                <h3 className="font-bold text-gray-900">Auto Sync</h3>
              </div>
              <p className="text-sm text-gray-600">
                Sync directly from eCrew using your credentials
              </p>
            </button>
          </div>

          {/* Auto Sync Section */}
          {showAutoSync && !success && (
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🔐</span>
                <h3 className="font-bold text-gray-900">eCrew Login Credentials</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Enter your eCrew credentials to automatically sync your roster. Your credentials are not stored.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Employee ID (رقم الوظيفي)
                  </label>
                  <input
                    type="text"
                    value={ecrewEmployeeId}
                    onChange={(e) => setEcrewEmployeeId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="123456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    eCrew Password
                  </label>
                  <div className="relative">
                    <input
                      type={showEcrewPassword ? "text" : "password"}
                      value={ecrewPassword}
                      onChange={(e) => setEcrewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="********"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEcrewPassword((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 z-10"
                      aria-label={showEcrewPassword ? "Hide password" : "Show password"}
                    >
                      {showEcrewPassword ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7" />
                          <circle cx="12" cy="12" r="3" />
                          <path d="M4 4l16 16" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm font-medium">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleAutoSync}
                  disabled={!ecrewEmployeeId || !ecrewPassword || loading}
                  className="w-full rounded-xl bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Syncing with eCrew..." : "Sync Roster"}
                </button>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                  <span className="font-semibold">Note:</span> Your eCrew credentials are used only for this sync and are not stored on our servers.
                </div>
              </div>
            </div>
          )}

          {/* Manual Upload Instructions */}
          {!showAutoSync && !success && (
            <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/50 p-6">
              <h3 className="font-bold text-blue-900 mb-3">How to export from eCrew:</h3>
              <ol className="space-y-2 text-sm text-blue-800">
                <li className="flex gap-2">
                  <span>1.</span>
                  <span>Go to <a href="https://ecrew.etihad.ae/ecrew" target="_blank" rel="noopener noreferrer" className="font-semibold underline">ecrew.etihad.ae</a></span>
                </li>
                <li className="flex gap-2">
                  <span>2.</span>
                  <span>Navigate to your roster/schedule page</span>
                </li>
                <li className="flex gap-2">
                  <span>3.</span>
                  <span>Export or download your roster as CSV or Excel</span>
                </li>
                <li className="flex gap-2">
                  <span>4.</span>
                  <span>Upload the file here</span>
                </li>
              </ol>
            </div>
          )}

          {/* CSV Format Guide */}
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="font-bold text-gray-900 mb-3">Expected CSV Format:</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-3 py-2 text-left">Date</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Flight No</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">From</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">To</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Dep Time</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Arr Time</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Aircraft</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Co-Pilot</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-gray-600">
                    <td className="border border-gray-300 px-3 py-2">2026-01-20</td>
                    <td className="border border-gray-300 px-3 py-2">EY123</td>
                    <td className="border border-gray-300 px-3 py-2">AUH</td>
                    <td className="border border-gray-300 px-3 py-2">LHR</td>
                    <td className="border border-gray-300 px-3 py-2">08:30</td>
                    <td className="border border-gray-300 px-3 py-2">13:45</td>
                    <td className="border border-gray-300 px-3 py-2">B787-9</td>
                    <td className="border border-gray-300 px-3 py-2">Capt. Ahmed</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Manual Upload Section */}
          {!showAutoSync && !success && (
            <div className="mb-6 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
              <div className="text-6xl mb-4">📄</div>
              <div className="mb-4">
                <label className="cursor-pointer inline-block rounded-xl bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition-colors">
                  Choose File
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
              {file && (
                <div className="mb-4 text-sm text-gray-600">
                  Selected: <span className="font-semibold text-blue-600">{file.name}</span>
                </div>
              )}
              {error && (
                <div className="mb-4 text-sm text-red-600 font-medium">
                  {error}
                </div>
              )}
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="rounded-xl bg-green-600 px-8 py-3 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Import Roster"}
              </button>
            </div>
          )}

          {/* Preview Section */}
          {success && previewData.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Header like eCrew Report */}
              <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-6 py-4 text-center">
                <h2 className="text-xl font-bold text-white">ETIHAD Airways</h2>
                <p className="text-blue-100 text-sm mt-1">Personal Crew Schedule Report</p>
                <p className="text-blue-200 text-xs mt-1">
                  {previewData.length} Flights Synced
                </p>
              </div>

              <div className="p-4 overflow-x-auto">
                {/* Schedule Table */}
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="border border-blue-500 px-2 py-2 text-left w-24">Date</th>
                      <th className="border border-blue-500 px-2 py-2 text-center w-16">Flight</th>
                      <th className="border border-blue-500 px-2 py-2 text-center w-20">Route</th>
                      <th className="border border-blue-500 px-2 py-2 text-center w-16">STD</th>
                      <th className="border border-blue-500 px-2 py-2 text-center w-16">STA</th>
                      <th className="border border-blue-500 px-2 py-2 text-center w-20">Aircraft</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData
                      .filter(f => f.departure && f.destination && !['OFF', 'ROFF', 'DAY'].includes(f.departure))
                      .map((flight, idx) => {
                        const date = new Date(flight.date);
                        const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
                        const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} ${dayName}`;

                        return (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                            <td className="border border-gray-300 px-2 py-2 font-medium text-gray-800">
                              {formattedDate}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center">
                              <span className="bg-blue-600 text-white px-2 py-1 rounded font-bold">
                                {flight.flight_number || flight.flightNumber}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center font-medium">
                              <span className="text-blue-700">{flight.departure}</span>
                              <span className="text-gray-400 mx-1">→</span>
                              <span className="text-green-700">{flight.destination}</span>
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center text-green-600 font-mono">
                              {flight.departure_time || flight.departureTime || '-'}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center text-red-600 font-mono">
                              {flight.arrival_time || flight.arrivalTime || '-'}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center text-gray-600">
                              {flight.aircraft || '-'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {/* Stats Summary */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">
                      {previewData.filter(f => f.departure && f.destination && !['OFF', 'ROFF', 'DAY'].includes(f.departure)).length}
                    </p>
                    <p className="text-xs text-blue-600">Total Flights</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">
                      {new Set(previewData.map(f => f.departure).filter(d => d && d.length === 3)).size}
                    </p>
                    <p className="text-xs text-green-600">Airports</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-700">
                      {new Set(previewData.map(f => f.date)).size}
                    </p>
                    <p className="text-xs text-purple-600">Flight Days</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-700">
                      {new Set(previewData.map(f => `${f.departure}-${f.destination}`)).size}
                    </p>
                    <p className="text-xs text-orange-600">Routes</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setSuccess(false);
                    setPreviewData([]);
                    setFile(null);
                    setError('');
                  }}
                  className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={loading}
                  className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : '✓ Confirm Import'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
