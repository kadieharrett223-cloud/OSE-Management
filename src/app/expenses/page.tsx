"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDueDate = (value?: string) => {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const isWithinRange = (value: string | undefined, start: string, end: string) => {
  if (!value) return false;
  return value >= start && value <= end;
};

type QboBill = {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt?: number;
  Balance?: number;
  VendorRef?: { value: string; name?: string };
  APAccountRef?: { value: string; name?: string };
  PrivateNote?: string;
};

type QboBillPayment = {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  TotalAmt?: number;
  VendorRef?: { value: string; name?: string };
  PrivateNote?: string;
};

export default function ExpensesPage() {
  const [bills, setBills] = useState<QboBill[]>([]);
  const [paidBills, setPaidBills] = useState<QboBillPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`;
  });

  const { startDate, endDate } = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = `${year}-${month.toString().padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${month.toString().padStart(2, "0")}-${lastDay}`;
    return { startDate: start, endDate: end };
  }, [selectedMonth]);

  useEffect(() => {
    const fetchBills = async () => {
      setLoading(true);
      setError(null);
      try {
        const [unpaidResponse, paidResponse] = await Promise.all([
          fetch("/api/qbo/bill/query?status=unpaid"),
          fetch(`/api/qbo/bill-payment/query?startDate=${startDate}&endDate=${endDate}`),
        ]);

        if (!unpaidResponse.ok) {
          const payload = await unpaidResponse.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to load unpaid bills from QBO");
        }

        if (!paidResponse.ok) {
          const payload = await paidResponse.json().catch(() => ({}));
          throw new Error(payload?.error || "Failed to load bill payments from QBO");
        }

        const unpaidData = await unpaidResponse.json();
        const paidData = await paidResponse.json();

        setBills(unpaidData?.bills || []);
        setPaidBills(paidData?.payments || []);
      } catch (err: any) {
        setError(err?.message || "Failed to load bills from QBO");
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [startDate, endDate]);

  const unpaidBillsForMonth = useMemo(() => {
    return bills.filter((bill) => isWithinRange(bill.DueDate || bill.TxnDate, startDate, endDate));
  }, [bills, startDate, endDate]);

  const totals = useMemo(() => {
    const totalAmount = unpaidBillsForMonth.reduce((sum, bill) => sum + (Number(bill.TotalAmt) || 0), 0);
    const totalBalance = unpaidBillsForMonth.reduce((sum, bill) => sum + (Number(bill.Balance) || 0), 0);
    return { totalAmount, totalBalance };
  }, [unpaidBillsForMonth]);

  const paidTotals = useMemo(() => {
    const totalPaid = paidBills.reduce((sum, payment) => sum + (Number(payment.TotalAmt) || 0), 0);
    return { totalPaid };
  }, [paidBills]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Expenses" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">
          <div className="mx-auto max-w-7xl px-8 py-6 space-y-6">
            <header className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700">Finance</p>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">Expenses</h1>
                  <p className="text-sm text-slate-600">Live bills and expenses pulled from QBO.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </header>

            <section className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Unpaid / To Be Paid Log</h2>
                <p className="text-xs text-slate-500">Bills due in {selectedMonth}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 border-b border-slate-200 px-5 py-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Total balance</p>
                  <p className="text-2xl font-semibold text-slate-900">${money(totals.totalBalance)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Total bill amount</p>
                  <p className="text-2xl font-semibold text-slate-900">${money(totals.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Open bills</p>
                  <p className="text-2xl font-semibold text-slate-900">{unpaidBillsForMonth.length}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {loading && (
                  <div className="px-5 py-6 text-sm text-slate-500">Loading bills from QBO…</div>
                )}
                {!loading && error && (
                  <div className="px-5 py-6 text-sm text-red-600">{error}</div>
                )}
                {!loading && !error && unpaidBillsForMonth.length === 0 && (
                  <div className="px-5 py-6 text-sm text-slate-500">No unpaid bills found for this month.</div>
                )}
                {!loading && !error &&
                  unpaidBillsForMonth.map((bill) => (
                    <div key={bill.Id} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-6">
                      <div className="md:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Vendor</p>
                        <p className="text-sm font-medium text-slate-900">
                          {bill.VendorRef?.name || "Unknown vendor"}
                        </p>
                        <p className="text-xs text-slate-500">Bill #{bill.DocNumber || bill.Id}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Bill date</p>
                        <p className="text-sm text-slate-600">{formatDate(bill.TxnDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Due date</p>
                        <p className="text-sm text-slate-600">{formatDueDate(bill.DueDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Balance</p>
                        <p className="text-sm font-semibold text-slate-900">${money(Number(bill.Balance) || 0)}</p>
                        <p className="text-xs text-slate-500">Total ${money(Number(bill.TotalAmt) || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Account</p>
                        <p className="text-sm text-slate-600">{bill.APAccountRef?.name || "—"}</p>
                        {bill.PrivateNote && (
                          <p className="text-xs text-slate-500 line-clamp-2">{bill.PrivateNote}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            <section className="rounded-xl bg-white shadow-md ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Paid Log</h2>
                <p className="text-xs text-slate-500">Bill payments for {selectedMonth}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 border-b border-slate-200 px-5 py-4 md:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Total paid</p>
                  <p className="text-2xl font-semibold text-slate-900">${money(paidTotals.totalPaid)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Payments</p>
                  <p className="text-2xl font-semibold text-slate-900">{paidBills.length}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Period</p>
                  <p className="text-sm text-slate-600">
                    {formatDate(startDate)} - {formatDate(endDate)}
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {loading && (
                  <div className="px-5 py-6 text-sm text-slate-500">Loading paid log from QBO…</div>
                )}
                {!loading && error && (
                  <div className="px-5 py-6 text-sm text-red-600">{error}</div>
                )}
                {!loading && !error && paidBills.length === 0 && (
                  <div className="px-5 py-6 text-sm text-slate-500">No bill payments found for this month.</div>
                )}
                {!loading && !error &&
                  paidBills.map((payment) => (
                    <div key={payment.Id} className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-5">
                      <div className="md:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Vendor</p>
                        <p className="text-sm font-medium text-slate-900">
                          {payment.VendorRef?.name || "Vendor"}
                        </p>
                        <p className="text-xs text-slate-500">Payment #{payment.DocNumber || payment.Id}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Paid date</p>
                        <p className="text-sm text-slate-600">{formatDate(payment.TxnDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Amount</p>
                        <p className="text-sm font-semibold text-slate-900">${money(Number(payment.TotalAmt) || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Notes</p>
                        <p className="text-sm text-slate-600">{payment.PrivateNote || "—"}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            <div className="rounded-xl bg-white p-5 shadow-md ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Next Steps</h2>
              <p className="mt-2 text-sm text-slate-600">
                Connect bill pay, payroll imports, or vendor schedules here when you’re ready.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
