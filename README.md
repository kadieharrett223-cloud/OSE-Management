## OSE Management Pricing + Commissions

Next.js App Router app that reproduces the Excel pricing workbook and scaffolds QuickBooks Online commission workflows.

### Quickstart
- Install deps: `npm install`
- Dev server: `npm run dev` then open http://localhost:3000
- Tests (Vitest): `npm test`
- Prisma generate/db push: `npm run db:generate` then `npm run db:push`
- Env: copy `.env.example` to `.env` and set `NEXTAUTH_SECRET`

### Using the app
1) Upload your Excel file (xlsx/xls) with headers (case-insensitive): Item No, Description, Supplier, FOB Cost, Ocean frt, importing, Zone 5, Multiplier.
2) Rows with an Item No are parsed and computed.
3) Edit FOB, Ocean, importing, Zone 5, or Multiplier inline; outputs update instantly.
4) Export results to CSV or XLSX with the computed columns.

### Pricing math (per row)
- Tariff + 105% = FOB Cost * 2
- Per Unit = Tariff + Ocean frt + importing
- Cost (w/shipping) = Per Unit + Zone 5
- Sell Price = Cost (w/shipping) * Multiplier
- Rounded Normal Price = floor(Sell Price, 5)
- List Price = Sell Price * 1.2
- Black Friday Pricing = List Price * 0.75
- Rounded Sale Price = floor(Black Friday Pricing, 100) - 1

### Commissions (QuickBooks Online)
- **Rep Types**:
	- **Commissioned Reps** (KLH, WL, RT, Jared): Earn percentage-based commission on sales
	- **Salary Workers** (SC, CR): Salaried; earn performance bonus when hitting the $150k sales threshold
	- Paired invoices like "SC/KLH" -> 100% commission to KLH; SC's sales count toward bonus progress

- **Commission Calculation**: Per line deducts shipping before commission; commissionable = max(0, qty * price - shipping); commission = commissionable * rate (commissioned reps only). Shipping pulled from Supabase price list (item_no match). Salary workers tracked only for bonus.

- **UI Tabs**:
	- **Commissioned** tab: Commissioned reps with % rates, totals, and invoice detail
	- **Salary Bonus** tab: Salary worker progress to $150k with progress bars and status

- **APIs**:
	- GET `/api/qbo/invoice/sales-by-rep?startDate=...&endDate=...&status=paid` — aggregates by rep type
	- GET `/api/qbo/invoice/by-rep?repName=...&startDate=...&endDate=...` — detailed invoices for a rep
	- POST `/api/reps/commission-rate` — update commission % for a rep
	- POST `/api/price-list/import` — bulk import price list with shipping costs

- **QBO Integration**: OAuth 2.0, Query API with pagination, refresh token handling
- **Roles/Data**: Admin (all reps) vs Sales Rep (self only) via NextAuth; Supabase for price list/wholesalers; Prisma schema for local data model

### Auth
- Route: `/api/auth/[...nextauth]` using Credentials provider (email/password)
- Users store `role` and optional `repId` mapping
- Session tokens include `role` and `repId` for authorization in APIs
- Local dev: Set `AUTH_DISABLED=true` in `.env.local` to bypass role checks

### Code map
- UI logic and imports: [src/app/page.tsx](src/app/page.tsx)
- Pricing math utilities: [src/lib/pricing.ts](src/lib/pricing.ts)
- Tests: [src/lib/pricing.test.ts](src/lib/pricing.test.ts)
- Commission calculator + helpers: [src/lib/commissions.ts](src/lib/commissions.ts)
- Rep type configuration: [src/lib/repTypes.ts](src/lib/repTypes.ts)
- Shipping deduction logic: [src/lib/shippingDeduction.ts](src/lib/shippingDeduction.ts)
- Prisma schema: [prisma/schema.prisma](prisma/schema.prisma)
- Auth config: [src/app/api/auth/[...nextauth]/route.ts](src/app/api/auth/[...nextauth]/route.ts)
- Commissions page: [src/app/commissions/page.tsx](src/app/commissions/page.tsx)
- Salary bonus tracker: [src/app/commissions/salary-bonus/page.tsx](src/app/commissions/salary-bonus/page.tsx)
- QBO OAuth: [src/app/api/qbo/connect/route.ts](src/app/api/qbo/connect/route.ts), [src/app/api/qbo/callback/route.ts](src/app/api/qbo/callback/route.ts)
- Sales by rep: [src/app/api/qbo/invoice/sales-by-rep/route.ts](src/app/api/qbo/invoice/sales-by-rep/route.ts)

### Notes
- Column names are matched case-insensitively; extra columns are ignored
- Outputs are formatted to two decimals; export retains raw numbers
- Rep names aliased automatically (e.g., "WL" and "Wholesale Lifts" treated as same rep)
- Shipping deduction uses fuzzy matching (Levenshtein distance <= 2) if exact SKU match fails

### Free mobile notifications (no paid provider)
- Set `MOBILE_NOTIFICATION_SMS_TO` in your env as comma-separated carrier gateway addresses.
- Example: `MOBILE_NOTIFICATION_SMS_TO=5551234567@vtext.com,5551234567@txt.att.net`
- Common gateways: Verizon `@vtext.com`, AT&T `@txt.att.net`, T-Mobile `@tmomail.net`.
- PO change notifications send email + SMS gateway text from `/api/purchase-orders/notify-changes`.
- Customer payment notifications are sent by cron when new QBO payments are detected (deduped by payment id).
- Manual calendar notifications send by phone at 8:00 AM local time on the day of the event.
- Set `MOBILE_NOTIFICATION_TIMEZONE` (default `America/New_York`) and `CRON_SECRET`.
- Vercel cron is configured at `/api/cron/mobile-notifications` every 5 minutes.
