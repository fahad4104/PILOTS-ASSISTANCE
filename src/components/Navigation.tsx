"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Navigation() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    return pathname === path;
  };

  const navItems = [
    { href: "/applications", label: "Applications", icon: "📱" },
    { href: "/ask", label: "Ask", icon: "💬" },
    { href: "/flight-plan", label: "Flight Plan", icon: "✈️" },
  ];

  // Add admin link if user is admin
  const adminNavItem = user?.rank === "Admin"
    ? { href: "/admin/approvals", label: "Approvals", icon: "👤" }
    : null;

  // Don't show navigation on login/signup pages
  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl">✈️</span>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              Pilot Assistance
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  isActive(item.href)
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}

            {/* Admin Approvals Link */}
            {adminNavItem && (
              <Link
                href={adminNavItem.href}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  isActive(adminNavItem.href)
                    ? "bg-orange-100 text-orange-700"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span>{adminNavItem.icon}</span>
                <span>{adminNavItem.label}</span>
              </Link>
            )}

            {/* User Info & Logout */}
            {user && (
              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-500">{user.rank}</div>
                  <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-all"
                >
                  <span>🚪</span>
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
