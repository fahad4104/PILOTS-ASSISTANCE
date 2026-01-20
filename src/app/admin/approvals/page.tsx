"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

type PendingUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  status: string;
  created_at: string;
};

export default function ApprovalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    // Only admin can access this page
    if (user && user.rank !== "Admin") {
      router.push("/roster");
      return;
    }

    loadPendingUsers();
  }, [user, router]);

  const loadPendingUsers = async () => {
    try {
      const response = await fetch('/api/users/pending');
      const data = await response.json();

      if (data.users) {
        setPendingUsers(data.users);

        // Initialize rank selection for each user
        const ranks: { [key: string]: string } = {};
        data.users.forEach((u: PendingUser) => {
          ranks[u.id] = "First Officer"; // Default rank
        });
        setSelectedRanks(ranks);
      }
    } catch (error) {
      console.error('Failed to load pending users:', error);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      const response = await fetch('/api/users/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          rank: selectedRanks[userId] || "First Officer",
        }),
      });

      const data = await response.json();

      if (data.success) {
        loadPendingUsers();
      } else {
        console.error('Failed to approve user:', data.error);
      }
    } catch (error) {
      console.error('Error approving user:', error);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const response = await fetch('/api/users/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (data.success) {
        loadPendingUsers();
      } else {
        console.error('Failed to reject user:', data.error);
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
    }
  };

  const handleRankChange = (userId: string, rank: string) => {
    setSelectedRanks(prev => ({
      ...prev,
      [userId]: rank
    }));
  };

  if (!user || user.rank !== "Admin") {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-5xl">👤</span>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                User Approvals
              </h1>
            </div>
            <p className="text-gray-600">Review and approve pending user registrations</p>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Pending</div>
              <div className="mt-2 text-3xl font-bold text-orange-600">{pendingUsers.length}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Users</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">--</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Admin Access</div>
              <div className="mt-2 text-lg font-bold text-green-600">Granted</div>
            </div>
          </div>

          {/* Pending Users List */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4">
              <h2 className="text-xl font-bold text-white">Pending Registrations</h2>
            </div>

            <div className="divide-y divide-gray-200">
              {pendingUsers.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <div className="text-gray-500 font-medium">No pending registrations</div>
                </div>
              ) : (
                pendingUsers.map((pendingUser) => (
                  <div key={pendingUser.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      {/* User Info */}
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                            {pendingUser.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-lg font-bold text-gray-900">{pendingUser.name}</div>
                            <div className="text-sm text-gray-600">{pendingUser.email}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          Registered: {pendingUser.created_at ? new Date(pendingUser.created_at).toLocaleString() : 'N/A'}
                        </div>
                      </div>

                      {/* Rank Selection */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Assign Rank
                        </label>
                        <select
                          value={selectedRanks[pendingUser.id] || "First Officer"}
                          onChange={(e) => handleRankChange(pendingUser.id, e.target.value)}
                          className="rounded-lg border-2 border-gray-200 px-4 py-2 text-sm font-semibold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="Captain">Captain</option>
                          <option value="First Officer">First Officer</option>
                          <option value="Second Officer">Second Officer</option>
                          <option value="Pilot">Pilot</option>
                        </select>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(pendingUser.id)}
                          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleReject(pendingUser.id)}
                          className="rounded-lg border border-red-300 bg-white px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
                        >
                          ✕ Reject
                        </button>
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
