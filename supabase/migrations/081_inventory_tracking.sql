-- Inventory tracking tables for products and linked invoices

create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null unique,
  on_floor integer not null default 0,
  sold integer not null default 0,
  available integer not null default 0
);

create table if not exists public.inventory_order_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  customer_name text not null,
  invoice_number text not null
);

create index if not exists idx_inventory_order_entries_product_id
  on public.inventory_order_entries(product_id);

create unique index if not exists uq_inventory_order_entries_product_invoice
  on public.inventory_order_entries(product_id, invoice_number);
