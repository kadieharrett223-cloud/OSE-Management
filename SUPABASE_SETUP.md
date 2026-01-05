# Supabase Setup - Next Steps

## ✅ Completed

1. **Supabase packages installed**
   - `@supabase/supabase-js`
   - `@supabase/auth-helpers-nextjs`

2. **Environment configured**
   - `.env.local` created with your Supabase credentials
   - Project URL: `https://fzirzlhnlsweqbdxnhvl.supabase.co`
   - Anon key configured (safe for browser use with RLS)

3. **Supabase client configured**
   - Browser client: `src/lib/supabase.ts`
   - Server client helper available
   - Connection test endpoint: `/api/test/supabase`

4. **Database schema ready**
   - Migration file: `supabase/migrations/001_initial_schema.sql`
   - Includes all tables with RLS policies

## ⬜ TODO: Run Database Migration

**You need to run the migration in Supabase Dashboard:**

1. Go to https://supabase.com/dashboard/project/fzirzlhnlsweqbdxnhvl
2. Navigate to **SQL Editor** in left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
5. Paste into the editor
6. Click **Run** (bottom right)
7. Verify success message

**Tables that will be created:**
- `users` - User accounts linked to Supabase Auth
- `reps` - Sales representatives
- `price_list_items` - SKU pricing and shipping deductions
- `invoices` - Synced from QuickBooks
- `invoice_lines` - Invoice line items
- `commission_snapshots` - Monthly aggregates for fast reads

**RLS Policies:**
- Admins can see everything
- Reps can only see their own data

## ⬜ TODO: Test Connection

After running the migration, test the connection:

1. Open http://localhost:3000/api/test/supabase
2. You should see:
   ```json
   {
     "connected": true,
     "message": "Supabase connection successful",
     "url": "https://fzirzlhnlsweqbdxnhvl.supabase.co"
   }
   ```

If you see an error, it means the migration hasn't been run yet.

## ⬜ TODO: Seed Initial Data

After migration succeeds, seed data using Supabase SQL Editor:

### 1. Create Admin User

First, create a user via Supabase Dashboard → Authentication → Users:
- Email: `admin@ose.com`
- Password: (your choice)
- Confirm email: Yes

Then link to users table:
```sql
INSERT INTO users (id, email, role)
VALUES ('USER_UUID_FROM_AUTH', 'admin@ose.com', 'admin');
```

### 2. Add Sales Reps

```sql
INSERT INTO reps (rep_name, qbo_rep_code, commission_rate, is_active)
VALUES 
  ('Sarah Johnson', 'SJ', 0.05, true),
  ('Mike Chen', 'MC', 0.05, true),
  ('Jessica Martinez', 'JM', 0.05, true),
  ('James Wilson', 'JW', 0.05, true);
```

### 3. Import Price List

```sql
INSERT INTO price_list_items (sku, description, current_sale_price_per_unit, shipping_included_per_unit)
VALUES
  ('SKU-001', 'Widget A', 2599.00, 125.00),
  ('SKU-002', 'Widget B', 1499.00, 85.00),
  ('SKU-003', 'Gadget C', 3999.00, 200.00);
```

## ⬜ TODO: Update Frontend Pages

Replace mock data with Supabase queries:

### Dashboard (`src/app/page.tsx`)

Replace:
```typescript
const mockReps = [...];
```

With:
```typescript
const { data: snapshots } = await supabase
  .from('commission_snapshots')
  .select(`
    *,
    reps (
      rep_name,
      qbo_rep_code
    )
  `)
  .eq('year', new Date().getFullYear())
  .eq('month', new Date().getMonth() + 1);
```

### Commissions Page (`src/app/commissions/page.tsx`)

Replace mock data with:
```typescript
const { data: reps } = await supabase
  .from('reps')
  .select('*')
  .eq('is_active', true);

const { data: invoices } = await supabase
  .from('invoices')
  .select(`
    *,
    invoice_lines (*)
  `)
  .eq('rep_id', selectedRepId);
```

### Price List Page (`src/app/admin/price-list/page.tsx`)

Update save handler to use Supabase:
```typescript
const { error } = await supabase
  .from('price_list_items')
  .upsert(items, { onConflict: 'sku' });
```

## ⬜ TODO: Get Service Role Key (Optional)

For server-side sync operations that bypass RLS:

1. Go to Supabase Dashboard → Settings → API
2. Find **Service Role Key** (secret)
3. Add to `.env.local`:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

**⚠️ Never expose this key in client-side code!**

## ⬜ TODO: Setup QuickBooks OAuth

1. Create app at https://developer.intuit.com
2. Get Client ID and Secret
3. Add to `.env.local`
4. Implement `/api/qbo/auth` and `/api/qbo/callback`
5. Test OAuth flow

## ⬜ TODO: Setup Sync Cron

Choose one:

**Option A: Vercel Cron (Production)**
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/sync/qbo",
    "schedule": "*/5 * * * *"
  }]
}
```

**Option B: Manual Sync Button**
Add to Dashboard UI (admin only)

## Testing RLS Policies

After seeding data, test policies:

```sql
-- As admin (set in SQL Editor)
SELECT auth.uid(); -- Should show admin UUID
SELECT * FROM commission_snapshots; -- Should see all

-- Create test rep user, then test as rep
SELECT * FROM commission_snapshots; -- Should see only own
```

## Quick Reference

- **Supabase Dashboard**: https://supabase.com/dashboard/project/fzirzlhnlsweqbdxnhvl
- **SQL Editor**: https://supabase.com/dashboard/project/fzirzlhnlsweqbdxnhvl/editor
- **Auth Users**: https://supabase.com/dashboard/project/fzirzlhnlsweqbdxnhvl/auth/users
- **Test Connection**: http://localhost:3000/api/test/supabase
- **Full Guide**: See `README_SUPABASE.md`

## Current Status

✅ Supabase configured and ready
✅ Dev server running
⬜ Migration needs to be run in Supabase Dashboard
⬜ Data needs to be seeded
⬜ Frontend needs to be updated to use Supabase

**Next immediate step: Run the migration in Supabase SQL Editor**
