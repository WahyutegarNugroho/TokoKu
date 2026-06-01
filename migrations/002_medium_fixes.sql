-- ==========================================
-- Migration: Medium Priority Fixes (#19-#25)
-- Date: 2026-05-21
-- ==========================================
-- Changes:
-- #22 Fix customers unique constraint on empty phone
-- #23 Fix store_invites code index to use upper()
-- #24 Add updated_at columns + triggers
-- ==========================================

-- #22: Replace unique constraint with partial index for customers phone
-- Drop the existing unique constraint (if exists)
alter table public.customers drop constraint if exists customers_store_id_phone_key;

-- Create partial index that only enforces uniqueness for non-empty phones
create unique index if not exists idx_customers_store_phone_nonempty
  on public.customers(store_id, phone)
  where phone != '';

-- #23: Replace raw code index with functional index on upper(code)
drop index if exists idx_store_invites_code;
create index if not exists idx_store_invites_code_upper
  on public.store_invites(upper(code));

-- #24: Add updated_at columns to mutable tables
alter table public.stores add column if not exists updated_at timestamptz default now();
alter table public.categories add column if not exists updated_at timestamptz default now();
alter table public.products add column if not exists updated_at timestamptz default now();
alter table public.customers add column if not exists updated_at timestamptz default now();
alter table public.store_invites add column if not exists updated_at timestamptz default now();
alter table public.store_members add column if not exists updated_at timestamptz default now();

-- Create the auto-update trigger function
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply triggers to all tables with updated_at
drop trigger if exists updated_at_stores on public.stores;
create trigger updated_at_stores
  before update on public.stores
  for each row execute function public.update_updated_at_column();

drop trigger if exists updated_at_categories on public.categories;
create trigger updated_at_categories
  before update on public.categories
  for each row execute function public.update_updated_at_column();

drop trigger if exists updated_at_products on public.products;
create trigger updated_at_products
  before update on public.products
  for each row execute function public.update_updated_at_column();

drop trigger if exists updated_at_customers on public.customers;
create trigger updated_at_customers
  before update on public.customers
  for each row execute function public.update_updated_at_column();

drop trigger if exists updated_at_store_invites on public.store_invites;
create trigger updated_at_store_invites
  before update on public.store_invites
  for each row execute function public.update_updated_at_column();

drop trigger if exists updated_at_store_members on public.store_members;
create trigger updated_at_store_members
  before update on public.store_members
  for each row execute function public.update_updated_at_column();
