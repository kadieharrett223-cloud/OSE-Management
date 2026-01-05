import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

// Client for browser usage (uses anon key + RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role key (bypasses RLS, for admin operations)
export function getServerSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set - using anon key (RLS will be enforced)');
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
