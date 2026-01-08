"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { getCommissionDateRange, getCurrentCommissionMonth } from "@/lib/commission-dates";

interface DailySales {
  date: string;
  totalSales: number;
  invoiceCount: number;
}

interface Notification {
  id: string;
  title: string;
  date: string;
  recurring: "none" | "daily" | "weekly" | "monthly";
  notes?: string;
}

const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CalendarPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentCommissionMonth());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(false);

  // Load notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("calendar-notifications");
    if (stored) {
      setNotifications(JSON.parse(stored));
    }
  }, []);

  // Save notifications to localStorage
  useEffect(() => {
    localStorage.setItem("calendar-notifications", JSON.stringify(notifications));
  }, [notifications]);

  // Generate calendar days
  const generateCalendarDays = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startPadding = firstDay.getDay();
    const days = [];

    // Add padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Add all days in month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month - 1, i));
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const handleSaveNotification = () => {
    if (!editingNotification) return;

    if (editingNotification.id) {
      // Update existing
      setNotifications(notifications.map(n => n.id === editingNotification.id ? editingNotification : n));
    } else {
      // Add new
      setNotifications([...notifications, { ...editingNotification, id: Date.now().toString() }]);
    }

    setShowAddModal(false);
    setEditingNotification(null);
  };

  const handleDeleteNotification = (id: string) => {
    if (confirm("Delete this notification?")) {
      setNotifications(notifications.filter(n => n.id !== id));
    }
  };

  const getNotificationsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return notifications.filter(n => {
      if (n.recurring === "none") return n.date === dateStr;
      if (n.recurring === "daily") return true;
      if (n.recurring === "weekly") return date.getDay() === new Date(n.date).getDay();
      if (n.recurring === "monthly") return date.getDate() === new Date(n.date).getDate();
      return false;
    });
  };

  const getSalesForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return dailySales.find(s => s.date === dateStr);
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activePage="Calendar" />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Sales Calendar</h1>
              <p className="text-slate-600">Daily sales tracking and recurring notifications</p>
            </div>
            <div className="flex gap-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => {
                  setEditingNotification({
                    id: "",
                    title: "",
                    date: new Date().toISOString().split("T")[0],
                    recurring: "none",
                  });
                  setShowAddModal(true);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Add Notification
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {/* Day headers */}
            <div className="mb-4 grid grid-cols-7 gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-xs font-semibold uppercase text-slate-500">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="h-32" />;
                }

                const dayNotifications = getNotificationsForDate(date);
                const sales = getSalesForDate(date);
                const today = isToday(date);

                return (
                  <div
                    key={date.toISOString()}
                    className={`h-32 overflow-hidden rounded-lg border p-2 ${
                      today
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-sm font-semibold ${today ? "text-blue-700" : "text-slate-700"}`}>
                        {date.getDate()}
                      </span>
                      {sales && (
                        <span className="text-xs font-semibold text-emerald-600">
                          ${money(sales.totalSales)}
                        </span>
                      )}
                    </div>

                    {/* Notifications */}
                    <div className="space-y-1">
                      {dayNotifications.slice(0, 2).map((notif) => (
                        <div
                          key={notif.id}
                          className="cursor-pointer truncate rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 hover:bg-blue-200"
                          onClick={() => {
                            setEditingNotification(notif);
                            setShowAddModal(true);
                          }}
                          title={notif.title}
                        >
                          {notif.recurring !== "none" && "🔁 "}
                          {notif.title}
                        </div>
                      ))}
                      {dayNotifications.length > 2 && (
                        <div className="text-xs text-slate-500">
                          +{dayNotifications.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Notifications */}
          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">All Notifications</h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">No notifications yet. Click "Add Notification" to create one.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{notif.title}</span>
                        {notif.recurring !== "none" && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                            {notif.recurring}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {new Date(notif.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      {notif.notes && <p className="mt-1 text-xs text-slate-500">{notif.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingNotification(notif);
                          setShowAddModal(true);
                        }}
                        className="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteNotification(notif.id)}
                        className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && editingNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">
              {editingNotification.id ? "Edit Notification" : "Add Notification"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  value={editingNotification.title}
                  onChange={(e) =>
                    setEditingNotification({ ...editingNotification, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g., Team Meeting, Follow-up Call"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                <input
                  type="date"
                  value={editingNotification.date}
                  onChange={(e) =>
                    setEditingNotification({ ...editingNotification, date: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Recurring</label>
                <select
                  value={editingNotification.recurring}
                  onChange={(e) =>
                    setEditingNotification({
                      ...editingNotification,
                      recurring: e.target.value as "none" | "daily" | "weekly" | "monthly",
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes (optional)</label>
                <textarea
                  value={editingNotification.notes || ""}
                  onChange={(e) =>
                    setEditingNotification({ ...editingNotification, notes: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Additional details..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingNotification(null);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotification}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
