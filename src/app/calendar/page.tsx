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
  recurring: "none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
  notes?: string;
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
      const hasHolidays = loadedNotifications.some((n: Notification) => 
        n.title === "New Year's Day" || n.notes?.includes("Federal Holiday")
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
      
      // Add US Federal Holidays
      if (!hasHolidays) {
        const holidays = [
          { title: "New Year's Day", date: "2026-01-01", notes: "Federal Holiday" },
          { title: "Martin Luther King Jr. Day", date: "2026-01-19", notes: "Federal Holiday - 3rd Monday in January" },
          { title: "Presidents' Day", date: "2026-02-16", notes: "Federal Holiday - 3rd Monday in February" },
          { title: "Memorial Day", date: "2026-05-25", notes: "Federal Holiday - Last Monday in May" },
          { title: "Independence Day", date: "2026-07-04", notes: "Federal Holiday" },
          { title: "Labor Day", date: "2026-09-07", notes: "Federal Holiday - 1st Monday in September" },
          { title: "Columbus Day", date: "2026-10-12", notes: "Federal Holiday - 2nd Monday in October" },
          { title: "Veterans Day", date: "2026-11-11", notes: "Federal Holiday" },
          { title: "Thanksgiving", date: "2026-11-26", notes: "Federal Holiday - 4th Thursday in November" },
          { title: "Christmas Day", date: "2026-12-25", notes: "Federal Holiday" }
        ];
        
        holidays.forEach((holiday, idx) => {
          loadedNotifications.push({
            id: "holiday-" + Date.now() + idx,
            title: holiday.title,
            date: holiday.date,
            recurring: "yearly",
            notes: holiday.notes
          });
        });
      }
      
      setNotifications(loadedNotifications);
    } else {
      // First time - create default notifications including holidays
      const defaultNotifications = [
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
        },
        // US Federal Holidays
        { id: "holiday-1", title: "New Year's Day", date: "2026-01-01", recurring: "yearly", notes: "Federal Holiday" },
        { id: "holiday-2", title: "Martin Luther King Jr. Day", date: "2026-01-19", recurring: "yearly", notes: "Federal Holiday - 3rd Monday in January" },
        { id: "holiday-3", title: "Presidents' Day", date: "2026-02-16", recurring: "yearly", notes: "Federal Holiday - 3rd Monday in February" },
        { id: "holiday-4", title: "Memorial Day", date: "2026-05-25", recurring: "yearly", notes: "Federal Holiday - Last Monday in May" },
        { id: "holiday-5", title: "Independence Day", date: "2026-07-04", recurring: "yearly", notes: "Federal Holiday" },
        { id: "holiday-6", title: "Labor Day", date: "2026-09-07", recurring: "yearly", notes: "Federal Holiday - 1st Monday in September" },
        { id: "holiday-7", title: "Columbus Day", date: "2026-10-12", recurring: "yearly", notes: "Federal Holiday - 2nd Monday in October" },
        { id: "holiday-8", title: "Veterans Day", date: "2026-11-11", recurring: "yearly", notes: "Federal Holiday" },
        { id: "holiday-9", title: "Thanksgiving", date: "2026-11-26", recurring: "yearly", notes: "Federal Holiday - 4th Thursday in November" },
        { id: "holiday-10", title: "Christmas Day", date: "2026-12-25", recurring: "yearly", notes: "Federal Holiday" }
      ];
      
      setNotifications(defaultNotifications as Notification[]);
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
        // Parse selected month (YYYY-MM format) and get calendar month range
        const [year, month] = selectedMonth.split("-").map(Number);
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
        
        console.log('[calendar] Selected month:', selectedMonth);
        console.log('[calendar] Fetching sales for calendar month:', startDate, 'to', endDate);
        
        // Fetch payments for the calendar month (use payment date)
        const paymentsUrl = `/api/qbo/payment/query?startDate=${startDate}&endDate=${endDate}`;
        console.log('[calendar] Payments API URL:', paymentsUrl);
        const paymentsResponse = await fetch(paymentsUrl);
        let payments: any[] = [];
        if (paymentsResponse.ok) {
          const paymentsResult = await paymentsResponse.json();
          payments = paymentsResult.payments || paymentsResult.QueryResponse?.Payment || (Array.isArray(paymentsResult) ? paymentsResult : []);
        } else {
          console.warn('[calendar] Failed to fetch payments, falling back to invoices');
        }
        
        // If no payments returned, fall back to invoices (invoice creation date)
        let invoices: any[] = [];
        if (payments.length === 0) {
          const invoicesUrl = `/api/qbo/invoice/query?startDate=${startDate}&endDate=${endDate}&status=paid`;
          console.log('[calendar] Invoices API URL (fallback):', invoicesUrl);
          const invoiceResponse = await fetch(invoicesUrl);
          if (!invoiceResponse.ok) throw new Error("Failed to fetch invoices");
          const invoiceResult = await invoiceResponse.json();
          invoices = invoiceResult.invoices || invoiceResult.QueryResponse?.Invoice || (Array.isArray(invoiceResult) ? invoiceResult : []);
        }
        
        const usingPayments = payments.length > 0;
        console.log('[calendar] Using payments:', usingPayments, 'payments:', payments.length, 'invoices fallback:', invoices.length);
        if (usingPayments) console.log('[calendar] Sample payment structure:', payments[0]);
        if (!usingPayments) console.log('[calendar] Sample invoice structure:', invoices[0]);
        
        // Group sales by payment date (preferred) or invoice date (fallback)
        const salesByDate: Record<string, { total: number; count: number }> = {};
        
        const source = usingPayments ? payments : invoices;
        source.forEach((item: any) => {
          const rawDate = item.TxnDate;
          if (!rawDate) return;
          const date = rawDate.split('T')[0];
          if (!salesByDate[date]) {
            salesByDate[date] = { total: 0, count: 0 };
          }
          if (usingPayments) {
            const total = Number(item.TotalAmt) || 0;
            const unapplied = Number(item.UnappliedAmt) || 0;
            const applied = total - unapplied;
            salesByDate[date].total += applied > 0 ? applied : 0;
          } else {
            salesByDate[date].total += item.TotalAmt || 0;
          }
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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activePage="Calendar" />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Sales Calendar</h1>
              <p className="text-slate-600">
                Daily sales tracking and recurring notifications
                {loading && <span className="ml-2 text-blue-600">Loading sales data...</span>}
                {!loading && dailySales.length > 0 && (
                  <span className="ml-2 text-emerald-600">
                    ({dailySales.length} days with sales)
                  </span>
                )}
              </p>
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
                        {sales.invoiceCount > 0 && (
                          <div className="text-[9px] text-emerald-700">
                            {sales.invoiceCount} invoice{sales.invoiceCount !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notifications */}
                    <div className="space-y-1">
                      {dayNotifications.slice(0, 2).map((notif) => {
                        const isHoliday = notif.notes?.includes("Federal Holiday");
                        return (
                          <div
                            key={notif.id}
                            className={`cursor-pointer truncate rounded px-1.5 py-0.5 text-[10px] hover:opacity-80 ${
                              isHoliday 
                                ? "bg-red-100 text-red-800" 
                                : "bg-blue-100 text-blue-800"
                            }`}
                            onClick={() => {
                              setEditingNotification(notif);
                              setShowAddModal(true);
                            }}
                            title={notif.title}
                          >
                            {isHoliday && "🇺🇸 "}
                            {notif.recurring !== "none" && !isHoliday && "🔁 "}
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
