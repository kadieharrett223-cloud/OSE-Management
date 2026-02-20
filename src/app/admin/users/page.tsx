"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type User = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "active">("pending");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/admin/users?ts=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve user");
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, active: true } : user)));
    } catch (error) {
      alert("Failed to approve user");
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm("Deactivate this user?")) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to deactivate user");
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, active: false } : user)));
    } catch (error) {
      alert("Failed to deactivate user");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Permanently delete this user? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      await fetchUsers();
    } catch (error) {
      alert("Failed to delete user");
    }
  };

  const filteredUsers = users.filter((user) => {
    if (filter === "pending") return !user.active;
    if (filter === "active") return user.active;
    return true;
  });

  const pendingCount = users.filter((u) => !u.active).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Users" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">
          <div className="mx-auto max-w-7xl px-8 py-8 space-y-6">
            <header className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700">Admin</p>
                  <h1 className="text-3xl font-semibold text-slate-900">User Management</h1>
                  <p className="text-sm text-slate-600 mt-1">Approve or manage user accounts</p>
                </div>
                {pendingCount > 0 && (
                  <div className="rounded-full bg-amber-100 border-2 border-amber-500 px-4 py-2">
                    <span className="text-sm font-bold text-amber-900">{pendingCount} pending approval</span>
                  </div>
                )}
              </div>
            </header>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("pending")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  filter === "pending"
                    ? "bg-amber-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setFilter("active")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  filter === "active"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                Active ({users.filter((u) => u.active).length})
              </button>
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                All ({users.length})
              </button>
            </div>

            {/* Users List */}
            <div className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="text-slate-600">Loading users...</div>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-lg font-semibold text-slate-900">No users found</div>
                  <div className="mt-2 text-sm text-slate-600">
                    {filter === "pending"
                      ? "No users are waiting for approval"
                      : "No users match this filter"}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Created
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{user.email}</td>
                          <td className="px-6 py-4">
                            <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 uppercase">
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                                user.active
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {user.active ? "Active" : "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {new Date(user.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {!user.active ? (
                                <button
                                  onClick={() => handleApprove(user.id)}
                                  className="px-3 py-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDeactivate(user.id)}
                                  className="px-3 py-1 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                                >
                                  Deactivate
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="px-3 py-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
