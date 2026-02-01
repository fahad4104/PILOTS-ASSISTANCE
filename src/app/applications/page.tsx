"use client";

import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";

const applications = [
  {
    id: "brake-cooling",
    name: "Brake Cooling Calculator",
    description: "Calculate maximum safe RTO speed before fuse plug melt zone",
    icon: "🛞",
    href: "/applications/brake-cooling",
    aircraft: "B777",
  },
];

export default function ApplicationsPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <main className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
            <p className="mt-2 text-gray-600">
              Aviation tools and calculators for pilots.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applications.map((app) => (
              <Link
                key={app.id}
                href={app.href}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-3xl group-hover:bg-blue-100 transition-colors">
                    {app.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {app.name}
                      </h3>
                      <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {app.aircraft}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {app.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
