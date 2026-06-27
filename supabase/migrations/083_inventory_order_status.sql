-- Add status tracking for inventory order entries

alter table if exists public.inventory_order_entries
  add column if not exists order_status text not null default 'on_order';

create index if not exists idx_inventory_order_entries_order_status
  on public.inventory_order_entries(order_status);
