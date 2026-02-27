"use client";

import { useState, useEffect, useMemo } from "react";
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
  recurring: "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
  notes?: string;
  source?: "user" | "bill";
}

interface QboBill {
  Id: string;
  DocNumber?: string;
  DueDate?: string;
  Balance?: number;
  TotalAmt?: number;
  VendorRef?: { value: string; name?: string };
}

const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CalendarPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [billNotifications, setBillNotifications] = useState<Notification[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(false);

  const monthlyTotal = useMemo(() => {
    return dailySales.reduce((sum, day) => sum + (day.totalSales || 0), 0);
  }, [dailySales]);

  useEffect(() => {
    const fetchBills = async () => {
      try {
        const response = await fetch("/api/qbo/bill/query?status=unpaid");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const bills: QboBill[] = data?.bills || [];
        const mapped: Notification[] = bills
          .filter((bill) => bill.DueDate)
          .map((bill, index) => ({
            id: `bill-${bill.Id}-${index}`,
            title: `Bill due: ${bill.VendorRef?.name || "Vendor"}`,
            date: bill.DueDate as string,
            recurring: "none",
            notes: `Balance $${money(Number(bill.Balance) || 0)}`,
            source: "bill" as const,
          }));
        setBillNotifications(mapped);
      } catch (error) {
        console.warn("[calendar] Failed to load bills from QBO", error);
      }
    };

    fetchBills();
  }, []);

  // Load manual notifications from server so cron can send mobile reminders
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await fetch("/api/calendar/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json();
        const loaded = Array.isArray(result?.notifications) ? result.notifications : [];
        setNotifications(loaded);
      } catch (error) {
        console.warn("[calendar] Failed to load server notifications", error);
      }
    };

    loadNotifications();
  }, []);

  // Fetch daily sales data for selected month
  useEffect(() => {
    const fetchDailySales = async () => {
      setLoading(true);
      try {
        // Parse selected month (YYYY-MM format) and get calendar month range
        const [year, month] = selectedMonth.split("-").map(Number);
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
        
        console.log('[calendar] Selected month:', selectedMonth);
        console.log('[calendar] Fetching sales for calendar month:', startDate, 'to', endDate);
        
        // Fetch paid invoices for the calendar month (use invoice TxnDate)
        const invoicesUrl = `/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}&status=paid`;
        console.log('[calendar] Invoices API URL:', invoicesUrl);
        const invoiceResponse = await fetch(invoicesUrl);
        if (!invoiceResponse.ok) throw new Error("Failed to fetch paid invoices");
        const invoiceResult = await invoiceResponse.json();
        const invoices = invoiceResult.invoices || [];
        
        console.log('[calendar] Paid invoices fetched:', invoices.length);
        if (invoices.length > 0) console.log('[calendar] Sample invoice structure:', invoices[0]);
        
        // Group sales by invoice TxnDate
        const salesByDate: Record<string, { total: number; count: number }> = {};
        
        invoices.forEach((invoice: any) => {
          const rawDate = invoice.TxnDate;
          if (!rawDate) return;
          const date = rawDate.split('T')[0];
          if (!salesByDate[date]) {
            salesByDate[date] = { total: 0, count: 0 };
          }
          const total = Number(invoice.TotalAmt) || 0;
          const balance = Number(invoice.Balance) || 0;
          const paid = total - balance;
          salesByDate[date].total += paid;
          salesByDate[date].count += 1;
        });
        
        console.log('[calendar] Grouped by date:', Object.keys(salesByDate).length, 'unique dates');
        console.log('[calendar] Sample grouped data:', Object.entries(salesByDate).slice(0, 5));
        console.log('[calendar] All grouped date keys:', Object.keys(salesByDate));
        
        // Create entries for ALL days in the month (including days with $0 sales)
        const dailySalesArray: DailySales[] = [];
        for (let day = 1; day <= lastDay; day++) {
          const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          const salesData = salesByDate[dateStr];
          
          dailySalesArray.push({
            date: dateStr,
            totalSales: salesData?.total || 0,
            invoiceCount: salesData?.count || 0
          });
        }
        
        setDailySales(dailySalesArray);
        console.log('[calendar] Daily sales loaded:', dailySalesArray.length, 'days with sales');
        console.log('[calendar] Sample dates:', dailySalesArray.slice(0, 3).map(d => d.date));
        console.log('[calendar] Full month range:', startDate, 'to', endDate);
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

  const handleSaveNotification = async () => {
    if (!editingNotification) return;
    if (!editingNotification.title?.trim()) return;
    if (!editingNotification.date?.trim()) return;

    const payload = {
      title: editingNotification.title,
      date: editingNotification.date,
      recurring: editingNotification.recurring,
      notes: editingNotification.notes || "",
    };

    try {
      if (editingNotification.id) {
        const response = await fetch(`/api/calendar/notifications/${editingNotification.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          alert(data?.error || "Failed to update notification");
          return;
        }

        const data = await response.json();
        setNotifications(notifications.map(n => n.id === editingNotification.id ? data.notification : n));
      } else {
        const response = await fetch("/api/calendar/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          alert(data?.error || "Failed to create notification");
          return;
        }

        const data = await response.json();
        setNotifications([...notifications, data.notification]);
      }
    } catch (error) {
      console.error("Failed to save notification", error);
      alert("Failed to save notification");
      return;
    }

    setShowAddModal(false);
    setEditingNotification(null);
  };

  const handleDeleteNotification = async (id: string) => {
    if (confirm("Delete this notification?")) {
      try {
        const response = await fetch(`/api/calendar/notifications/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const data = await response.json();
          alert(data?.error || "Failed to delete notification");
          return;
        }
      } catch (error) {
        console.error("Failed to delete notification", error);
        alert("Failed to delete notification");
        return;
      }
      setNotifications(notifications.filter(n => n.id !== id));
    }
  };

  const getNotificationsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const combined = [...notifications, ...billNotifications];
    return combined.filter(n => {
      if (n.recurring === "none") return n.date === dateStr;
      if (n.recurring === "daily") return true;
      if (n.recurring === "weekly") return date.getDay() === new Date(n.date).getDay();
      if (n.recurring === "monthly") return date.getDate() === new Date(n.date).getDate();
      if (n.recurring === "yearly") {
        // Match month and day, regardless of year
        const notifDate = new Date(n.date);
        return date.getMonth() === notifDate.getMonth() && date.getDate() === notifDate.getDate();
      }
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
    // Format date as YYYY-MM-DD in local timezone (no UTC conversion)
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const found = dailySales.find(s => s.date === dateStr);
    return found;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Calendar" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Sales Calendar</h1>
                <p className="text-slate-600">
                  Daily sales tracking and recurring notifications
                  {loading && <span className="ml-2 text-blue-600">Loading sales data...</span>}
                </p>
                {!loading && dailySales.length > 0 && (
                  <div className="mt-1 text-sm font-semibold text-emerald-700">
                    Month total: ${money(monthlyTotal)}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
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
          <div className="rounded-xl bg-white p-4 md:p-6 shadow-sm ring-1 ring-slate-200">
            {/* Day headers */}
            <div className="mb-3 grid grid-cols-7 gap-1 md:mb-4 md:gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-[10px] font-semibold uppercase text-slate-500 md:text-xs">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {calendarDays.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="h-20 md:h-32" />;
                }

                const dayNotifications = getNotificationsForDate(date);
                const sales = getSalesForDate(date);
                const today = isToday(date);

                return (
                  <div
                    key={date.toISOString()}
                    className={`h-20 overflow-hidden rounded-lg border p-1 md:h-32 md:p-2 ${
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

                    {/* Notifications */}
                    <div className="space-y-1">
                      {dayNotifications.slice(0, 2).map((notif) => {
                        const isHoliday = notif.notes?.includes("Federal Holiday");
                        const isBill = notif.source === "bill";
                        return (
                          <div
                            key={notif.id}
                            className={`truncate rounded px-1.5 py-0.5 text-[10px] hover:opacity-80 ${
                              isHoliday
                                ? "bg-red-100 text-red-800"
                                : isBill
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-blue-100 text-blue-800"
                            }`}
                            onClick={() => {
                              if (isBill) return;
                              setEditingNotification(notif);
                              setShowAddModal(true);
                            }}
                            title={notif.title}
                          >
                            {isHoliday && "🇺🇸 "}
                            {isBill && "💳 "}
                            {notif.recurring !== "none" && !isHoliday && !isBill && "🔁 "}
                            {notif.title}
                          </div>
                        );
                      })}
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
        </div>
      </main>
    </div>

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
                      recurring: e.target.value as "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly",
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly (every 2 weeks)</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly (annual)</option>
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
