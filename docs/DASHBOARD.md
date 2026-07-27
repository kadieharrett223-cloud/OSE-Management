# Dashboard

## Customer payments summary

- Route: `/`
- UI owner: `src/app/page.tsx`
- Data source: `src/app/api/dashboard/summary/route.ts`
- External dependency: QuickBooks Query API `Payment` and `Invoice`

The dashboard shows two summary datasets and one on-demand dataset:

- `Customer Payments Today`: merged from QBO `Payment` records received today plus fully paid invoices dated today.
- `Customer Payments Yesterday`: merged from the same two QBO sources for the previous business date.
- `Customer Payments (Selected Date)`: fetched on demand from `src/app/api/qbo/payment/query/route.ts` with `startDate` and `endDate` set to the same date (`YYYY-MM-DD`) so the full selected calendar day is returned.

Both sections use the same merge rules so totals stay consistent across the KPI card, payment tables, and the `View all` modal:

- Applied amount is `TotalAmt - UnappliedAmt` for payment records.
- Fully paid invoices are included once.
- Linked invoice amounts from payment lines are deduped by invoice id.
- Remaining unlinked applied amounts are still shown as customer payments.

The top customer payments card on the dashboard includes three filter options:

- `Today`
- `Yesterday`
- `Select Date`

`Today` and `Yesterday` switch between the already-fetched `customerPaymentsToday` and `customerPaymentsYesterday` arrays from the dashboard summary payload. `Select Date` shows a date picker and makes a dedicated API request for the chosen day, then displays those full-day payment results in the same table and `View all` modal.

## Risk

Low risk. This is a read-only dashboard change that extends the existing summary payload and does not write to QuickBooks, Supabase, or Prisma.