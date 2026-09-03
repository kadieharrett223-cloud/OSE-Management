# Special Orders

The Special Orders page at `/admin/special-orders` tracks factory-specific work linked to a QuickBooks invoice.

## Invoice data flow

1. The page loads an order from `GET /api/special-orders/[id]`.
2. When the order has `qbo_invoice_id`, the route reads that invoice from QuickBooks with `authorizedQboFetch`.
3. The route maps the QuickBooks `SalesItemLineDetail` records into `invoiceSummary.lineItems` with description, quantity, unit price, and amount.
4. The page displays those line items in the linked QuickBooks Invoice section and includes them on the printable special-order form.

Invoice data is read live from QuickBooks and is not copied into or modified by the Special Orders tables. If QuickBooks is unavailable, the rest of the special-order details remain available but the invoice summary and lines are omitted.