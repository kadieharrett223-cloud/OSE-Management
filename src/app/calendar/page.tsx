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
  recurring: "none" | "daily" | "weekly" | "biweekly" | "monthly";
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

  // Load notifications from localStorage and add default notifications
  useEffect(() => {
    const stored = localStorage.getItem("calendar-notifications");
    if (stored) {
      const loadedNotifications = JSON.parse(stored);
      
      // Check if default notifications exist, if not add them
      const hasSalesMonthNotif = loadedNotifications.some((n: Notification) => 
        n.title === "Sales Month Begins" && n.recurring === "monthly"
      );
      const hasPaydayNotif = loadedNotifications.some((n: Notification) => 
        n.title === "Payday" && n.recurring === "biweekly"
      );
      
      if (!hasSalesMonthNotif) {
        loadedNotifications.push({
          id: "sales-month-" + Date.now(),
          title: "Sales Month Begins",
          date: "2026-01-05", // 5th of month
          recurring: "monthly",
          notes: "Commission period starts today (5th to 4th)"
        });
      }
      
      if (!hasPaydayNotif) {
        loadedNotifications.push({
          id: "payday-" + Date.now(),
          title: "Payday",
          date: "2026-01-10", // Starting Friday, Jan 10, 2026
          recurring: "biweekly",
          notes: "Bi-weekly payday"
        });
      }
      
      setNotifications(loadedNotifications);
    } else {
      // First time - create default notifications
      setNotifications([
        {
          id: "sales-month-" + Date.now(),
          title: "Sales Month Begins",
          date: "2026-01-05",
          recurring: "monthly",
          notes: "Commission period starts today (5th to 4th)"
        },
        {
          id: "payday-" + Date.now() + 1,
          title: "Payday",
          date: "2026-01-10",
          recurring: "biweekly",
          notes: "Bi-weekly payday"
        }
      ]);
    }
  }, []);

  // Save notifications to localStorage
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem("calendar-notifications", JSON.stringify(notifications));
    }
  }, [notifications]);

  // Fetch daily sales data for selected month
  useEffect(() => {
    const fetchDailySales = async () => {
      setLoading(true);
      try {
        const dateRange = getCommissionDateRange(selectedMonth);
        const response = await fetch(
          `/api/qbo/invoice/query?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&status=paid`
        );
        
        if (!response.ok) throw new Error("Failed to fetch invoices");
        
        const data = await response.json();
        
        // Group sales by date
        const salesByDate: Record<string, { total: number; count: number }> = {};
        
        data.forEach((invoice: any) => {
          const date = invoice.MetaData?.LastUpdatedTime?.split("T")[0] || 
                       invoice.TxnDate;
          
          if (!salesByDate[date]) {
            salesByDate[date] = { total: 0, count: 0 };
          }
          
          salesByDate[date].total += invoice.TotalAmt || 0;
          salesByDate[date].count += 1;
        });
        
        // Convert to array
        const dailySalesArray = Object.entries(salesByDate).map(([date, data]) => ({
          date,
          totalSales: data.total,
          invoiceCount: data.count
        }));
        
        setDailySales(dailySalesArray);
      } catch (error) {
        console.error("Error fetching daily sales:", error);
        setDailySales([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDailySales();
  }, [selectedMonth]);

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
      if (n.recurring === "biweekly") {
        // Calculate days between start date and current date
        const startDate = new Date(n.date);
        const diffTime = date.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        // Show if it's a multiple of 14 days from start date
        return diffDays >= 0 && diffDays % 14 === 0;
      }
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
                    </div>

                    {/* Daily Sales Total */}
                    {sales && (
                      <div className="mb-1.5 rounded bg-emerald-50 px-1.5 py-0.5">
                        <div className="text-[10px] font-medium text-emerald-900">
                          ${money(sales.totalSales)}
                        </div>
                        <div className="text-[9px] text-emerald-700">
                          {sales.invoiceCount} invoice{sales.invoiceCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}

                    {/* Notifications */}
                    <div className="space-y-1">
                      {dayNotifications.slice(0, 2).map((notif) => (
                        <div
                          key={notif.id}
                          className="cursor-pointer truncate rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-800 hover:bg-blue-200"
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
                        <div className="text-[9px] text-slate-500">
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
                      recurring: e.target.value as "none" | "daily" | "weekly" | "biweekly" | "monthly",
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly (every 2 weeks)</option>
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
