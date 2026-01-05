# Supabase Multi-User Dashboard Setup

## Overview

This app now uses **Supabase** (PostgreSQL + Auth) for multi-user live dashboards with row-level security. QuickBooks syncing happens server-side only, with snapshots stored in Supabase for fast frontend reads.

## Architecture

```
┌─────────────────┐
│   QuickBooks    │  (OAuth, server-side only)
│     Online      │
└────────┬────────┘
         │
         │ Sync every 2-5 min
         ↓
┌─────────────────┐
│  API Route      │  /api/sync/qbo
│  (Server-side)  │  - Fetch invoices
└────────┬────────┘  - Calculate commissions
         │           - Update Supabase
         ↓
┌─────────────────┐
│   Supabase      │  PostgreSQL + RLS
│   (Postgres)    │  - invoices
└────────┬────────┘  - invoice_lines
         │           - commission_snapshots
         │           - price_list_items
         │
         │ Read (with RLS)
         ↓
┌─────────────────┐
│   Dashboard     │  Next.js Client
│   (Browser)     │  - Admin: see all
└─────────────────┘  - Rep: see own data only
```

## Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and keys:
   - **Project URL**: `https://[your-project].supabase.co`
   - **Anon/Public Key**: Found in Settings → API
   - **Service Role Key**: Found in Settings → API (keep secret!)

### 2. Run Database Migration

1. In Supabase Dashboard, go to **SQL Editor**
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run the migration
4. Verify tables created: `users`, `reps`, `price_list_items`, `invoices`, `invoice_lines`, `commission_snapshots`

### 3. Configure Environment Variables

Create `.env.local` in project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# QuickBooks (server-side only)
QBO_CLIENT_ID=your-qbo-client-id
QBO_CLIENT_SECRET=your-qbo-client-secret
QBO_REDIRECT_URI=http://localhost:3000/api/qbo/callback
QBO_ENVIRONMENT=sandbox

# Sync cron secret
CRON_SECRET=your-random-secret-here
```

### 4. Seed Initial Data

#### Create Admin User

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" → Email signup
3. Note the UUID
4. In SQL Editor, run:

```sql
INSERT INTO users (id, email, role)
VALUES ('user-uuid-here', 'admin@ose.com', 'admin');
```

#### Add Sales Reps

```sql
INSERT INTO reps (rep_name, qbo_rep_code, commission_rate)
VALUES 
  ('John Smith', 'JS', 0.05),
  ('Sarah Johnson', 'SJ', 0.05),
  ('Mike Chen', 'MC', 0.05);
```

#### Import Price List

Use the Admin Price List page (`/admin/price-list`) or SQL:

```sql
INSERT INTO price_list_items (sku, description, current_sale_price_per_unit, shipping_included_per_unit)
VALUES
  ('SKU-001', 'Widget A', 2599.00, 125.00),
  ('SKU-002', 'Widget B', 1499.00, 85.00),
  ('SKU-003', 'Gadget C', 3999.00, 200.00);
```

### 5. Setup QuickBooks OAuth (Server-Side)

1. Create app at [developer.intuit.com](https://developer.intuit.com)
2. Get Client ID and Secret
3. Set Redirect URI: `http://localhost:3000/api/qbo/callback`
4. Add to `.env.local`
5. Implement OAuth flow in `/api/qbo/auth` and `/api/qbo/callback`

### 6. Setup Sync Cron Job

#### Option A: Vercel Cron (Production)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/sync/qbo",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

#### Option B: GitHub Actions (Development)

Create `.github/workflows/sync-qbo.yml`:

```yaml
name: Sync QBO Invoices
on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync
        run: |
          curl -X POST https://your-app.vercel.app/api/sync/qbo \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

#### Option C: Manual Sync Button

Add a "Sync Now" button in the dashboard that calls `/api/sync/qbo` (admin only).

## Row-Level Security (RLS)

Supabase automatically enforces these policies:

### Admins
- See **all** invoices, lines, snapshots, reps
- Manage price list
- View all users

### Sales Reps
- See **only their own** invoices, lines, snapshots
- Read-only price list
- Cannot see other reps' data

### Anonymous/Unauthenticated
- No access (all tables require auth)

## Data Flow

### Sync Flow (Every 2-5 Minutes)

1. **Cron triggers** `/api/sync/qbo` with secret
2. **Server fetches** QBO invoices (OAuth token refresh)
3. **For each invoice**:
   - Match Sales Rep field → `reps.rep_name`
   - Map line SKUs → `price_list_items`
   - Calculate commission: `max(0, line_total - (qty × shipping_included_per_unit)) × rep_rate`
   - Upsert to `invoices` + `invoice_lines`
4. **Recompute snapshots** for affected rep/month
5. **Dashboard auto-updates** (Supabase real-time optional)

### Dashboard Read Flow

1. **User logs in** via Supabase Auth
2. **Frontend queries** `commission_snapshots` table
3. **RLS enforces** role-based filtering:
   - Admin: `SELECT * FROM commission_snapshots`
   - Rep: `SELECT * FROM commission_snapshots WHERE rep_id = current_user.rep_id`
4. **Dashboard renders** summary cards, leaderboard, invoice detail

## Frontend Updates Needed

### 1. Replace Mock Data

**Dashboard** (`src/app/page.tsx`):
```typescript
// Before
const mockReps = [...]

// After
const { data: snapshots } = await supabase
  .from('commission_snapshots')
  .select('*, reps(rep_name)')
  .eq('year', 2024)
  .eq('month', 1);
```

### 2. Add Auth Check

```typescript
import { supabase } from '@/lib/supabase';

export default async function Dashboard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  
  // Fetch data with RLS applied automatically
  const { data: snapshots } = await supabase
    .from('commission_snapshots')
    .select('*');
  
  return <DashboardUI data={snapshots} />;
}
```

### 3. Real-Time Updates (Optional)

```typescript
useEffect(() => {
  const channel = supabase
    .channel('commission_updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'commission_snapshots'
    }, (payload) => {
      console.log('Snapshot updated:', payload);
      // Refresh data
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

## Testing

### Test RLS Policies

```sql
-- As admin (set in Supabase Dashboard → SQL Editor → RLS tab)
SET request.jwt.claim.sub = 'admin-user-uuid';
SELECT * FROM commission_snapshots; -- Should see all

-- As rep
SET request.jwt.claim.sub = 'rep-user-uuid';
SELECT * FROM commission_snapshots; -- Should see only own
```

### Test Sync

```bash
curl -X POST http://localhost:3000/api/sync/qbo \
  -H "Authorization: Bearer your-cron-secret"
```

Should return:
```json
{
  "success": true,
  "synced": 5,
  "affectedSnapshots": 3
}
```

## Migration from Prisma

1. **Keep Prisma** for local dev if needed, or remove:
   ```bash
   npm uninstall prisma @prisma/client @next-auth/prisma-adapter
   ```

2. **Update imports**:
   ```typescript
   // Before
   import { prisma } from '@/lib/prisma';
   
   // After
   import { supabase } from '@/lib/supabase';
   ```

3. **Convert queries**:
   ```typescript
   // Before
   const reps = await prisma.rep.findMany();
   
   // After
   const { data: reps } = await supabase.from('reps').select('*');
   ```

## Security Notes

1. **Never expose** `SUPABASE_SERVICE_ROLE_KEY` in client code
2. **All QBO operations** must be server-side (API routes)
3. **RLS is automatic** — frontend can't bypass policies
4. **Anon key is safe** — it's rate-limited and RLS-enforced
5. **Cron secret** should be random and stored in Vercel env

## Next Steps

1. ✅ Install Supabase packages
2. ✅ Create database schema
3. ✅ Setup environment variables
4. ⬜ Run migration in Supabase Dashboard
5. ⬜ Seed initial users/reps/price list
6. ⬜ Implement QBO OAuth flow
7. ⬜ Update Dashboard to read from Supabase
8. ⬜ Update Commissions page to read from Supabase
9. ⬜ Update Price List page to write to Supabase
10. ⬜ Deploy sync cron job
11. ⬜ Test RLS policies
12. ⬜ Remove Prisma (optional)
