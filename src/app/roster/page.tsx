"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

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

export default function RosterPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    if (user) {
      // Load flights for this user from localStorage
      const userFlights = JSON.parse(localStorage.getItem(`flights_${user.id}`) || "[]");
      setFlights(userFlights);
    }
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-100 text-blue-700 border-blue-200";
      case "completed": return "bg-green-100 text-green-700 border-green-200";
      case "cancelled": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "scheduled": return "Scheduled";
      case "completed": return "Completed";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  // Filter flights by selected month
  const filteredFlights = flights.filter(flight => {
    return flight.date.startsWith(selectedMonth);
  });

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-5xl">📅</span>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  Flight Roster
                </h1>
                <p className="text-gray-600 mt-1">Your monthly flight schedule</p>
              </div>
            </div>

            {/* Month selector and Import button */}
            <div className="flex items-center gap-3">
              <Link href="/roster/import">
                <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors flex items-center gap-2">
                  <span>📥</span>
                  <span>Import Roster</span>
                </button>
              </Link>
              <label className="text-sm font-medium text-gray-700">Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Link href="/ask">
              <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:border-blue-300 cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-3xl">
                    💬
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                      Ask Pilot Assistance
                    </h3>
                    <p className="text-sm text-gray-600">
                      Search aviation manuals and get instant answers
                    </p>
                  </div>
                  <svg className="h-6 w-6 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            <Link href="/flight-plan">
              <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:border-blue-300 cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-100 text-3xl">
                    ✈️
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                      Flight Plan Analyzer
                    </h3>
                    <p className="text-sm text-gray-600">
                      Upload and analyze your OFP documents
                    </p>
                  </div>
                  <svg className="h-6 w-6 text-gray-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Flights</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{flights.length}</div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
            <div className="text-sm font-medium text-blue-600 uppercase tracking-wide">Scheduled</div>
            <div className="mt-2 text-3xl font-bold text-blue-900">
              {filteredFlights.filter(f => f.status === "scheduled").length}
            </div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-5 shadow-sm">
            <div className="text-sm font-medium text-green-600 uppercase tracking-wide">Completed</div>
            <div className="mt-2 text-3xl font-bold text-green-900">
              {filteredFlights.filter(f => f.status === "completed").length}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Flight Hours</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">--</div>
          </div>
        </div>

        {/* Flight List */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Flight Schedule</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredFlights.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">📭</div>
                <div className="text-gray-500 font-medium">No flights scheduled for this month</div>
              </div>
            ) : (
              filteredFlights.map((flight) => (
                <div key={flight.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    {/* Date */}
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-blue-50 border border-blue-200">
                        <div className="text-xs font-semibold text-blue-600 uppercase">
                          {new Date(flight.date).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="text-2xl font-bold text-blue-900">
                          {new Date(flight.date).getDate()}
                        </div>
                      </div>

                      {/* Flight Details */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-gray-900">{flight.flightNumber}</span>
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(flight.status)}`}>
                            {getStatusText(flight.status)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">{flight.aircraft}</div>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-xs font-medium text-gray-500 mb-1">FROM</div>
                        <div className="text-xl font-bold text-gray-900">{flight.departure}</div>
                        <div className="text-sm font-medium text-gray-600">{flight.departureTime}</div>
                      </div>

                      <div className="flex flex-col items-center px-4">
                        <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>

                      <div className="text-center">
                        <div className="text-xs font-medium text-gray-500 mb-1">TO</div>
                        <div className="text-xl font-bold text-gray-900">{flight.destination}</div>
                        <div className="text-sm font-medium text-gray-600">{flight.arrivalTime}</div>
                      </div>
                    </div>

                    {/* Co-Pilot */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Co-Pilot</div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                        <span className="text-lg">👨‍✈️</span>
                        <span className="font-semibold text-gray-900">
                          {flight.coPilot || "TBA"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
