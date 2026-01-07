-- Create table to store per-rep commission rates
create table if not exists rep_commission_rates (
  rep_name text primary key,
  commission_rate numeric not null default 0.05,
  updated_at timestamptz not null default now()
);

-- Basic RLS policy (optional). We will use service role for writes.
alter table rep_commission_rates enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rep_commission_rates' and policyname = 'rep_commission_rates: read'
  ) then
    create policy "rep_commission_rates: read" on rep_commission_rates for select to authenticated using (true);
  end if;
end $$;
