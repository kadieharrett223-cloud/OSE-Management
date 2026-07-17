# Dashboard

## Customer payments summary

- Route: `/`
- UI owner: `src/app/page.tsx`
- Data source: `src/app/api/dashboard/summary/route.ts`
- External dependency: QuickBooks Query API `Payment` and `Invoice`

The dashboard shows two customer payment datasets:

- `Customer Payments Today`: merged from QBO `Payment` records received today plus fully paid invoices dated today.
- `Customer Payments Yesterday`: merged from the same two QBO sources for the previous business date.

Both sections use the same merge rules so totals stay consistent across the KPI card, payment tables, and the `View all` modal:

- Applied amount is `TotalAmt - UnappliedAmt` for payment records.
- Fully paid invoices are included once.
- Linked invoice amounts from payment lines are deduped by invoice id.
- Remaining unlinked applied amounts are still shown as customer payments.

The top customer payments card on the dashboard includes a local `Today` / `Yesterday` toggle. That toggle does not make another API request; it switches between the already-fetched `customerPaymentsToday` and `customerPaymentsYesterday` arrays from the dashboard summary payload. The lower duplicate yesterday table was removed so this top card is now the single dashboard entry point for both payment-day views.

## Risk

Low risk. This is a read-only dashboard change that extends the existing summary payload and does not write to QuickBooks, Supabase, or Prisma.