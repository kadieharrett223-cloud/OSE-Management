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
- Linked invoice amounts from payment lines are itemized per payment event, even when multiple payments apply to the same invoice.
- Remaining unlinked applied amounts are still shown as customer payments.

To avoid double counting, invoice fallback rows are skipped only when the invoice already appeared in linked payment rows.

The top customer payments card on the dashboard includes three filter options:

- `Today`
- `Yesterday`
- `Select Date`

`Today` and `Yesterday` switch between the already-fetched `customerPaymentsToday` and `customerPaymentsYesterday` arrays from the dashboard summary payload. `Select Date` shows a date picker and makes a dedicated API request for the chosen day, then displays those full-day payment results in the same table and `View all` modal.

### Print report behavior

When the `Print Report` button is used from the customer payments modal on `src/app/page.tsx`, the print preview now includes:

- `Charge New Card (Ran Through QuickBooks)` (first section): sourced from active dashboard payment rows where `Paid Via` indicates a card charge (for example Visa, American Express, Credit Card labels).
- `Record Payment (Recorded in QuickBooks)` (second section): all remaining rows (including Shopify-style recorded payments) and includes `Invoice #` as a print-only column.

This keeps the report to the two QuickBooks invoice payment actions only: card charge vs record payment.

Screen tables are unchanged; this two-option split only affects the generated print document.

## Risk

Low risk. This is a read-only dashboard change that extends the existing summary payload and does not write to QuickBooks, Supabase, or Prisma.