-- Container tracking linked to inventory products

create table if not exists public.inventory_containers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  container_code text not null unique,
  status text not null default 'in_transit'
);

create table if not exists public.inventory_container_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  container_id uuid not null references public.inventory_containers(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 0)
);

create index if not exists idx_inventory_container_items_container_id
  on public.inventory_container_items(container_id);

create index if not exists idx_inventory_container_items_product_id
  on public.inventory_container_items(product_id);

create unique index if not exists uq_inventory_container_items_container_product
  on public.inventory_container_items(container_id, product_id);
