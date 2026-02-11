export interface ExpenseItem {
  category: "Bills To Pay" | "Expenses" | "Payroll";
  name: string;
  dueDate: string;
  amount: number;
}

export const expenseItems: ExpenseItem[] = [
  { category: "Bills To Pay", name: "Qingdao Hiker Machinery", dueDate: "2026-02-15", amount: 12850 },
  { category: "Bills To Pay", name: "OEC Freight", dueDate: "2026-02-18", amount: 3240 },
  { category: "Bills To Pay", name: "Warehouse Utilities", dueDate: "2026-02-20", amount: 980 },
  { category: "Expenses", name: "Shipping supplies", dueDate: "2026-02-12", amount: 420 },
  { category: "Expenses", name: "Software subscriptions", dueDate: "2026-02-22", amount: 860 },
  { category: "Expenses", name: "Rep travel", dueDate: "2026-02-25", amount: 1450 },
  { category: "Payroll", name: "Bi-weekly payroll", dueDate: "2026-02-16", amount: 24500 },
  { category: "Payroll", name: "Commission payouts", dueDate: "2026-02-28", amount: 8200 },
];
