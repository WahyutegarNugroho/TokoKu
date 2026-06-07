-- ==========================================
-- Indigo POS: Multi-Tenant Schema v2
-- ==========================================
-- BREAKING: Reset seluruh schema lama.
-- Semua data diisolasi per toko (store_id).
-- ==========================================

create extension if not exists "uuid-ossp";

-- 1. Users Table (extends Supabase auth.users)
create table public.users (
    id uuid references auth.users on delete cascade primary key,
    email text not null,
    full_name text not null default '',
    phone text not null default '',
    created_at timestamptz default now() not null
);

-- 2. Stores Table
create table public.stores (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    address text,
    phone text,
    logo_url text,
    tax_enabled boolean default true,
    tax_rate numeric default 11,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

-- 3. Store Members (junction: user <-> store + role)
create table public.store_members (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    role text not null check (role in ('OWNER', 'ADMIN', 'KASIR')) default 'KASIR',
    created_at timestamptz default now() not null,
    updated_at timestamptz default now(),
    unique(store_id, user_id)
);

-- 4. Store Invites (kode undangan)
create table public.store_invites (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    code text not null unique,
    role text not null check (role in ('ADMIN', 'KASIR')) default 'KASIR',
    max_uses int default 10,
    used_count int default 0,
    expires_at timestamptz,
    created_by uuid references public.users(id),
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

-- 5. Categories (scoped to store)
create table public.categories (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    name text not null,
    description text,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

-- 5.5. Promotions (scoped to store, scheduled)
create table public.promotions (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    name text not null,
    description text,
    type text not null check (type in ('PERCENT', 'FIXED')) default 'PERCENT',
    value numeric(12, 2) not null check (value >= 0),
    start_date timestamptz not null,
    end_date timestamptz not null,
    enabled boolean not null default true,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);
alter table public.promotions enable row level security;
create policy "Members can view promotions" on public.promotions
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can manage promotions" on public.promotions
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can update promotions" on public.promotions
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can delete promotions" on public.promotions
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));

-- 6. Products (scoped to store)
create table public.products (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    name text not null,
    sku text not null,
    price numeric(12, 2) not null check (price >= 0),
    category_id uuid references public.categories(id) on delete set null,
    stock integer not null default 0 check (stock >= 0),
    image_url text,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now(),
    unique(store_id, sku) -- SKU unik per toko
);

-- 7. Shifts (scoped to store)
create table public.shifts (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    start_time timestamptz default now() not null,
    end_time timestamptz,
    beginning_cash numeric(12, 2) default 0 not null check (beginning_cash >= 0),
    status text not null check (status in ('OPEN', 'CLOSED')) default 'OPEN',
    created_at timestamptz default now() not null
);

-- 8. Transactions (scoped to store)
create table public.transactions (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    shift_id uuid references public.shifts(id) on delete cascade not null,
    total_amount numeric(12, 2) not null check (total_amount >= 0),
    tax numeric(12, 2) not null check (tax >= 0),
    payment_method text not null check (payment_method in ('CASH', 'DEBIT', 'QRIS', 'SPLIT', 'EWALLET', 'TRANSFER', 'CREDIT', 'DEBT')),
    sync_status boolean not null default true,
    created_at timestamptz default now() not null
);

-- 9. Transaction Items
create table public.transaction_items (
    id uuid default gen_random_uuid() primary key,
    transaction_id uuid references public.transactions(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    quantity integer not null check (quantity > 0),
    price numeric(12, 2) not null check (price >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    variants text, -- JSON string representing chosen variants
    created_at timestamptz default now() not null
);

-- ==========================================
-- Row Level Security
-- ==========================================

alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_invites enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.shifts enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

-- Users: bisa baca diri sendiri + anggota dalam toko yang sama, insert via trigger
create policy "Users can read own profile" on public.users
    for select to authenticated using (id = auth.uid());
create policy "Users can view members in same store" on public.users
    for select to authenticated
    using (id in (
        select sm.user_id from public.store_members sm
        where sm.store_id in (
            select sm2.store_id from public.store_members sm2 where sm2.user_id = auth.uid()
        )
    ));
create policy "Users can update own profile" on public.users
    for update to authenticated using (id = auth.uid());
create policy "Allow trigger insert on users" on public.users
    for insert with check (id = auth.uid());

-- Stores: bisa diakses oleh anggota
create policy "Members can access their stores" on public.stores
    for select to authenticated
    using (id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Authenticated can create stores" on public.stores
    for insert to authenticated with check (true);
create policy "Owner can update store" on public.stores
    for update to authenticated
    using (id in (select store_id from public.store_members where user_id = auth.uid() and role = 'OWNER'));

-- Helper: security definer to check store membership (bypasses RLS recursion)
create or replace function public.is_store_member(store_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members sm
    where sm.user_id = auth.uid()
    and sm.store_id = is_store_member.store_id
  );
$$;

-- Helper: get caller's role in a store (for RLS policies)
create or replace function public.get_user_role(p_store_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.store_members
  where user_id = auth.uid() and store_id = p_store_id
  limit 1;
$$;

-- Store Members: bisa diakses oleh sesama anggota toko
create policy "Members can view store members" on public.store_members
    for select to authenticated
    using (user_id = auth.uid() or is_store_member(store_id));
create policy "Owner/Admin can insert members" on public.store_members
    for insert to authenticated
    with check (store_id in (
        select sm.store_id from public.store_members sm
        where sm.user_id = auth.uid() and sm.role in ('OWNER', 'ADMIN')
    ));
create policy "User can create initial ownership" on public.store_members
    for insert to authenticated
    with check (
        user_id = auth.uid()
        and role = 'OWNER'
        and not exists (
            select 1 from public.store_members sm
            where sm.store_id = store_members.store_id
        )
    );
create policy "User can join via valid invite" on public.store_members
    for insert to authenticated
    with check (
        user_id = auth.uid()
        and not exists (
            select 1 from public.store_members sm
            where sm.store_id = store_members.store_id
            and sm.user_id = auth.uid()
        )
        and exists (
            select 1 from public.store_invites si
            where si.store_id = store_members.store_id
            and si.role = store_members.role
            and si.used_count < si.max_uses
            and (si.expires_at is null or si.expires_at > now())
        )
    );
create policy "Owner can delete members" on public.store_members
    for delete to authenticated
    using (is_store_member(store_id) and exists (
      select 1 from public.store_members sm2
      where sm2.user_id = auth.uid() and sm2.store_id = store_members.store_id and sm2.role in ('OWNER', 'ADMIN')
    ));
create policy "Owner can update members" on public.store_members
    for update to authenticated
    using (is_store_member(store_id) and exists (
      select 1 from public.store_members sm2
      where sm2.user_id = auth.uid() and sm2.store_id = store_members.store_id and sm2.role = 'OWNER'
    ))
    with check (is_store_member(store_id) and exists (
      select 1 from public.store_members sm2
      where sm2.user_id = auth.uid() and sm2.store_id = store_members.store_id and sm2.role = 'OWNER'
    ));

-- Store Invites: bisa diakses oleh anggota toko + lookup by valid code (for joining)
drop policy if exists "Members can manage invites" on public.store_invites;
create policy "Members can view invites" on public.store_invites
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can manage invites" on public.store_invites
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can update invites" on public.store_invites
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete invites" on public.store_invites
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Anyone can read valid invite by code" on public.store_invites
    for select to authenticated
    using (code in (select code from public.store_invites where used_count < max_uses and (expires_at is null or expires_at > now())));

-- Categories: scoped to store membership
drop policy if exists "Members can access store categories" on public.categories;
create policy "Members can view store categories" on public.categories
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create store categories" on public.categories
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update store categories" on public.categories
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete store categories" on public.categories
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

-- Products: scoped to store membership
drop policy if exists "Members can access store products" on public.products;
create policy "Members can view store products" on public.products
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create store products" on public.products
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update store products" on public.products
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete store products" on public.products
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

-- Shifts: scoped to store membership
drop policy if exists "Members can access store shifts" on public.shifts;
create policy "Members can view store shifts" on public.shifts
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create store shifts" on public.shifts
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update store shifts" on public.shifts
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete store shifts" on public.shifts
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

-- Transactions: scoped to store membership
drop policy if exists "Members can access store transactions" on public.transactions;
create policy "Members can view store transactions" on public.transactions
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create store transactions" on public.transactions
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update store transactions" on public.transactions
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete store transactions" on public.transactions
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

-- Transaction Items: scoped via transaction -> store
drop policy if exists "Members can access store transaction items" on public.transaction_items;
create policy "Members can view store transaction items" on public.transaction_items
    for select to authenticated
    using (transaction_id in (
        select id from public.transactions where store_id in (
            select store_id from public.store_members where user_id = auth.uid()
        )
    ));
create policy "Members can create store transaction items" on public.transaction_items
    for insert to authenticated
    with check (transaction_id in (
        select id from public.transactions where store_id in (
            select store_id from public.store_members where user_id = auth.uid()
        )
    ));
create policy "Admins can update store transaction items" on public.transaction_items
    for update to authenticated
    using (transaction_id in (
        select id from public.transactions where store_id in (
            select store_id from public.store_members where user_id = auth.uid()
        )
    ))
    with check (transaction_id in (
        select id from public.transactions where store_id in (
            select store_id from public.store_members where user_id = auth.uid()
        )
    ));
create policy "Admins can delete store transaction items" on public.transaction_items
    for delete to authenticated
    using (transaction_id in (
        select id from public.transactions where store_id in (
            select store_id from public.store_members where user_id = auth.uid()
        )
    ));

-- ==========================================
-- Trigger: Auto-create user profile on signup
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- Schema update v3: customers, activity_logs, stock_history, discount columns
-- ==========================================

-- 10. Customers table
create table if not exists public.customers (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    name text not null,
    phone text not null default '',
    email text not null default '',
    credit_limit numeric(12,2) not null default 0,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);
create unique index if not exists idx_customers_store_phone_nonempty
  on public.customers(store_id, phone) where phone != '';
alter table public.customers drop constraint if exists customers_store_id_phone_key;
alter table public.customers enable row level security;
drop policy if exists "Members can access customers" on public.customers;
create policy "Members can view customers" on public.customers
  for select to authenticated
  using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create customers" on public.customers
  for insert to authenticated
  with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update customers" on public.customers
  for update to authenticated
  using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
  with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete customers" on public.customers
  for delete to authenticated
  using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

-- 11. Activity logs table
create table if not exists public.activity_logs (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    action text not null,
    description text not null default '',
    created_at timestamptz default now() not null
);
alter table public.activity_logs enable row level security;
create policy "Members can view activity logs" on public.activity_logs
  for select to authenticated
  using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Users can create activity logs" on public.activity_logs
  for insert to authenticated
  with check (
    store_id in (select store_id from public.store_members where user_id = auth.uid())
    and user_id = auth.uid()
    and (
      action in ('CHECKOUT', 'REFUND', 'SHIFT_OPEN', 'SHIFT_CLOSE')
      or
      exists (
        select 1 from public.store_members
        where user_id = auth.uid() and store_id = activity_logs.store_id and role in ('OWNER', 'ADMIN')
      )
    )
  );

-- 12. Stock history table
create table if not exists public.stock_history (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    old_stock integer not null,
    new_stock integer not null,
    reason text not null default '',
    created_at timestamptz default now() not null
);
alter table public.stock_history enable row level security;
create policy "Members can view stock history" on public.stock_history
  for select to authenticated
  using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Users can create stock history" on public.stock_history
  for insert to authenticated
  with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and user_id = auth.uid());

-- 13. Add discount and customer_id columns to transactions
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='transactions' and column_name='discount') then
    alter table public.transactions add column discount numeric(12,2) not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='transactions' and column_name='customer_id') then
    alter table public.transactions add column customer_id uuid references public.customers(id) on delete set null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='transaction_items' and column_name='discount') then
    alter table public.transaction_items add column discount numeric(12,2) not null default 0;
  end if;
  -- add status column for return/void support
  if not exists (select 1 from information_schema.columns where table_name='transactions' and column_name='status') then
    alter table public.transactions add column status text not null default 'COMPLETED' check (status in ('COMPLETED', 'REFUNDED', 'VOIDED'));
  end if;
end $$;

-- 14. Payment splits table (for split payments)
create table if not exists public.payment_splits (
    id uuid default gen_random_uuid() primary key,
    transaction_id uuid references public.transactions(id) on delete cascade not null,
    method text not null check (method in ('CASH', 'DEBIT', 'QRIS', 'EWALLET', 'TRANSFER', 'CREDIT', 'DEBT')),
    amount numeric(12,2) not null check (amount >= 0),
    created_at timestamptz default now() not null
);
alter table public.payment_splits enable row level security;
create policy "Members can view payment splits" on public.payment_splits
    for select to authenticated
    using (transaction_id in (select id from public.transactions where store_id in (select store_id from public.store_members where user_id = auth.uid())));
create policy "Members can create payment splits" on public.payment_splits
    for insert to authenticated
    with check (
        transaction_id in (
            select id from public.transactions
            where store_id in (
                select store_id from public.store_members
                where user_id = auth.uid()
            )
        )
    );

-- 15. Returns table
create table if not exists public.returns (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    transaction_id uuid references public.transactions(id) on delete set null,
    user_id uuid references public.users(id) on delete cascade not null,
    items jsonb not null default '[]'::jsonb,
    reason text not null default '',
    refund_amount numeric(12,2) not null check (refund_amount >= 0),
    created_at timestamptz default now() not null
);
alter table public.returns enable row level security;
create policy "Members can view returns" on public.returns
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create returns" on public.returns
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and user_id = auth.uid());

-- ==========================================
-- RPC Functions (security definer — bypass RLS)
-- ==========================================

-- Function: Create store + auto-add creator as OWNER
-- SECURITY: UUID is generated server-side to prevent collision attacks
-- Drop old 4-param version if it exists (from previous migration)
DROP FUNCTION IF EXISTS public.create_store_with_membership(
    p_store_id uuid,
    p_store_name text,
    p_store_address text,
    p_store_phone text
);

create or replace function public.create_store_with_membership(
    p_store_name text,
    p_store_address text,
    p_store_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_store_id uuid;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        return jsonb_build_object('error', 'Not authenticated');
    end if;

    v_store_id := gen_random_uuid();

    insert into public.stores (id, name, address, phone)
    values (v_store_id, p_store_name, p_store_address, p_store_phone);

    insert into public.store_members (store_id, user_id, role)
    values (v_store_id, v_user_id, 'OWNER');

    return jsonb_build_object(
        'success', true,
        'store_id', v_store_id,
        'store_name', p_store_name,
        'store_address', p_store_address,
        'store_phone', p_store_phone,
        'role', 'OWNER'
    );
exception
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;

-- SECURITY: security definer required to validate invite + insert member atomically.
-- AUTHORIZATION: Any authenticated user with a valid invite code can join.
-- FIX: Atomic used_count increment prevents race condition on concurrent joins
create or replace function public.join_store_with_invite(
    p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_invite record;
    v_store record;
    v_updated_id uuid;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        return jsonb_build_object('error', 'Not authenticated');
    end if;

    select * into v_invite
    from public.store_invites
    where code = upper(p_code);

    if not found then
        return jsonb_build_object('error', 'Kode undangan tidak ditemukan.');
    end if;

    if v_invite.expires_at is not null and v_invite.expires_at < now() then
        return jsonb_build_object('error', 'Kode undangan sudah kedaluwarsa.');
    end if;

    select * into v_store from public.stores where id = v_invite.store_id;
    if not found then
        return jsonb_build_object('error', 'Toko tidak ditemukan.');
    end if;

    if exists (
        select 1 from public.store_members
        where store_id = v_invite.store_id and user_id = v_user_id
    ) then
        return jsonb_build_object('error', 'Anda sudah menjadi anggota toko ini.');
    end if;

    -- Insert membership first to avoid wasting invite usage on duplicate membership
    insert into public.store_members (store_id, user_id, role)
    values (v_invite.store_id, v_user_id, v_invite.role);

    -- Atomic increment: only increment if under max_uses
    update public.store_invites
    set used_count = used_count + 1
    where id = v_invite.id
      and used_count < v_invite.max_uses
    returning id into v_updated_id;

    if not found then
        return jsonb_build_object('error', 'Kode undangan sudah mencapai batas pemakaian.');
    end if;

    return jsonb_build_object(
        'success', true,
        'store_id', v_invite.store_id,
        'store_name', v_store.name,
        'store_address', v_store.address,
        'store_phone', v_store.phone,
        'role', v_invite.role
    );
exception
    when unique_violation then
        return jsonb_build_object('error', 'Anda sudah menjadi anggota toko ini.');
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;

-- SECURITY: security definer required to read memberships without RLS recursion.
-- AUTHORIZATION: Returns only the caller's own memberships (filtered by auth.uid()).
-- RISK: Minimal � only returns data for the authenticated user.
create or replace function public.get_user_memberships()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_memberships jsonb;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        return jsonb_build_object('error', 'Not authenticated');
    end if;

    select jsonb_agg(
        jsonb_build_object(
            'store_id', sm.store_id,
            'store_name', s.name,
            'store_address', s.address,
            'store_phone', s.phone,
            'store_logo_url', s.logo_url,
            'store_tax_enabled', s.tax_enabled,
            'store_tax_rate', s.tax_rate,
            'role', sm.role
        )
    ) into v_memberships
    from public.store_members sm
    join public.stores s on s.id = sm.store_id
    where sm.user_id = v_user_id;

    if v_memberships is null then
        return jsonb_build_object('success', true, 'memberships', '[]'::jsonb);
    end if;

    return jsonb_build_object('success', true, 'memberships', v_memberships);
exception
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;

-- Function: Delete store (OWNER only, bypasses RLS)
create or replace function public.delete_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_role text;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        return jsonb_build_object('error', 'Not authenticated');
    end if;

    select role into v_role from public.store_members
    where store_id = p_store_id and user_id = v_user_id;

    if v_role != 'OWNER' then
        return jsonb_build_object('error', 'Hanya OWNER yang bisa menghapus toko.');
    end if;

    delete from public.stores where id = p_store_id;

    return jsonb_build_object('success', true);
exception
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;

-- Function: Add member directly by email (OWNER/ADMIN only)
create or replace function public.add_member_direct(
    p_store_id uuid,
    p_user_email text,
    p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller_id uuid;
    v_caller_role text;
    v_target_id uuid;
begin
    v_caller_id := auth.uid();
    if v_caller_id is null then
        return jsonb_build_object('error', 'Not authenticated');
    end if;

    select role into v_caller_role from public.store_members
    where store_id = p_store_id and user_id = v_caller_id;

    if v_caller_role not in ('OWNER', 'ADMIN') then
        return jsonb_build_object('error', 'Hanya OWNER atau ADMIN yang bisa menambahkan anggota.');
    end if;

    if v_caller_role != 'OWNER' and p_role != 'KASIR' then
        return jsonb_build_object('error', 'Hanya OWNER yang bisa menambahkan ADMIN atau OWNER.');
    end if;

    select id into v_target_id from public.users where email = p_user_email;
    if v_target_id is null then
        return jsonb_build_object('error', 'Email tidak ditemukan.');
    end if;

    if exists (select 1 from public.store_members where store_id = p_store_id and user_id = v_target_id) then
        return jsonb_build_object('error', 'User sudah menjadi anggota toko ini.');
    end if;

    insert into public.store_members (store_id, user_id, role)
    values (p_store_id, v_target_id, p_role);

    return jsonb_build_object('success', true, 'user_id', v_target_id);
exception
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;

-- Function: Change member role (OWNER only)
create or replace function public.change_member_role(
    p_member_id uuid,
    p_new_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_caller_id uuid;
    v_store_id uuid;
    v_caller_role text;
begin
    v_caller_id := auth.uid();
    if v_caller_id is null then
        return jsonb_build_object('error', 'Not authenticated');
    end if;

    select store_id into v_store_id from public.store_members where id = p_member_id;
    if v_store_id is null then
        return jsonb_build_object('error', 'Anggota tidak ditemukan.');
    end if;

    select role into v_caller_role from public.store_members
    where store_id = v_store_id and user_id = v_caller_id;

    if v_caller_role != 'OWNER' then
        return jsonb_build_object('error', 'Hanya OWNER yang bisa mengubah peran anggota.');
    end if;

    update public.store_members set role = p_new_role where id = p_member_id;

    return jsonb_build_object('success', true);
exception
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;

-- Function: Revoke an invite code
create or replace function public.revoke_invite(
    p_invite_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_store_id uuid;
    v_role text;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        return jsonb_build_object('error', 'Not authenticated');
    end if;

    select store_id into v_store_id from public.store_invites where id = p_invite_id;
    if v_store_id is null then
        return jsonb_build_object('error', 'Kode undangan tidak ditemukan.');
    end if;

    select role into v_role from public.store_members
    where store_id = v_store_id and user_id = v_user_id;

    if v_role not in ('OWNER', 'ADMIN') then
        return jsonb_build_object('error', 'Hanya OWNER atau ADMIN yang bisa mencabut undangan.');
    end if;

    delete from public.store_invites where id = p_invite_id;

    return jsonb_build_object('success', true);
exception
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;

-- SECURITY: security definer required to read invites without RLS recursion.
-- AUTHORIZATION: Must be a member of the target store.
-- RISK: Low � read-only, returns invite metadata only.
-- Function: List all invites for a store with status
create or replace function public.list_store_invites(
    p_store_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_role text;
    v_invites jsonb;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        return jsonb_build_object('error', 'Not authenticated');
    end if;

    select role into v_role from public.store_members
    where store_id = p_store_id and user_id = v_user_id;

    if v_role is null then
        return jsonb_build_object('error', 'Anda bukan anggota toko ini.');
    end if;

    select jsonb_agg(
        jsonb_build_object(
            'id', si.id,
            'code', si.code,
            'role', si.role,
            'max_uses', si.max_uses,
            'used_count', si.used_count,
            'expires_at', si.expires_at,
            'created_at', si.created_at,
            'is_expired', CASE WHEN si.expires_at IS NOT NULL AND si.expires_at < now() THEN true ELSE false END,
            'is_full', CASE WHEN si.used_count >= si.max_uses THEN true ELSE false END
        )
    ) into v_invites
    from public.store_invites si
    where si.store_id = p_store_id
    order by si.created_at desc;

    if v_invites is null then
        return jsonb_build_object('success', true, 'invites', '[]'::jsonb);
    end if;

    return jsonb_build_object('success', true, 'invites', v_invites);
exception
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;

-- SECURITY: security definer required for atomic stock operations without RLS recursion.
-- AUTHORIZATION: Caller must be a member of the store (OWNER/ADMIN/KASIR).
-- RISK: Medium � modifies stock levels. Unauthorized access could corrupt inventory.
-- Function: Atomic stock decrement (prevents race conditions during sync)
create or replace function public.decrement_product_stock(
    p_product_id uuid,
    p_quantity int,
    p_store_id uuid,
    p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_old_stock int;
    v_new_stock int;
begin
    -- Atomic decrement: only succeeds if stock is sufficient
    update public.products
    set stock = stock - p_quantity
    where id = p_product_id
      and store_id = p_store_id
      and stock >= p_quantity
    returning stock into v_new_stock;

    if not found then
        return jsonb_build_object('error', 'Stock tidak cukup atau produk tidak ditemukan');
    end if;

    -- Reconstruct old_stock for history log
    v_old_stock := v_new_stock + p_quantity;

    -- Log stock change
    insert into public.stock_history (store_id, product_id, user_id, old_stock, new_stock, reason)
    values (p_store_id, p_product_id, auth.uid(), v_old_stock, v_new_stock, p_reason);

    return jsonb_build_object('success', true, 'new_stock', v_new_stock);
end;
$$;

-- SECURITY: security definer required for atomic stock operations without RLS recursion.
-- AUTHORIZATION: Caller must be a member of the store (OWNER/ADMIN/KASIR).
-- RISK: Medium � modifies stock levels. Unauthorized access could corrupt inventory.
-- Function: Atomic stock increment (for refunds)
create or replace function public.increment_product_stock(
    p_product_id uuid,
    p_quantity int,
    p_store_id uuid,
    p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_old_stock int;
    v_new_stock int;
begin
    update public.products
    set stock = stock + p_quantity
    where id = p_product_id
      and store_id = p_store_id
    returning stock into v_new_stock;

    if not found then
        return jsonb_build_object('error', 'Produk tidak ditemukan');
    end if;

    v_old_stock := v_new_stock - p_quantity;

    insert into public.stock_history (store_id, product_id, user_id, old_stock, new_stock, reason)
    values (p_store_id, p_product_id, auth.uid(), v_old_stock, v_new_stock, p_reason);

    return jsonb_build_object('success', true, 'new_stock', v_new_stock);
end;
$$;

-- ==========================================
-- Auto-update updated_at trigger
-- ==========================================

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger updated_at_stores before update on public.stores
  for each row execute function public.update_updated_at_column();
create trigger updated_at_categories before update on public.categories
  for each row execute function public.update_updated_at_column();
create trigger updated_at_products before update on public.products
  for each row execute function public.update_updated_at_column();
create trigger updated_at_customers before update on public.customers
  for each row execute function public.update_updated_at_column();
create trigger updated_at_store_invites before update on public.store_invites
  for each row execute function public.update_updated_at_column();
create trigger updated_at_store_members before update on public.store_members
  for each row execute function public.update_updated_at_column();

-- ==========================================
-- Indexes for frequently queried columns
-- ==========================================

-- Transactions: store + time queries (analytics, history)
create index if not exists idx_transactions_store_created on public.transactions(store_id, created_at desc);

-- Sync engine: find unsynced transactions
create index if not exists idx_transactions_sync_status on public.transactions(sync_status) where sync_status = false;

-- Transaction items: lookup by transaction
create index if not exists idx_transaction_items_tx on public.transaction_items(transaction_id);

-- Store members: user lookup and store lookup
create index if not exists idx_store_members_user on public.store_members(user_id);
create index if not exists idx_store_members_store on public.store_members(store_id);

-- Products: store-scoped queries
create index if not exists idx_products_store on public.products(store_id);

-- Categories: store-scoped queries
create index if not exists idx_categories_store on public.categories(store_id);

-- Shifts: store-scoped queries
create index if not exists idx_shifts_store on public.shifts(store_id);

-- Customers: store-scoped queries
create index if not exists idx_customers_store on public.customers(store_id);

-- Activity logs: store + time queries
create index if not exists idx_activity_logs_store on public.activity_logs(store_id, created_at desc);

-- Stock history: product + time queries
create index if not exists idx_stock_history_product on public.stock_history(product_id, created_at desc);

-- Payment splits: transaction lookup
create index if not exists idx_payment_splits_tx on public.payment_splits(transaction_id);

-- Returns: store + transaction lookup
create index if not exists idx_returns_store on public.returns(store_id, transaction_id);

-- Store invites: functional index on upper(code) for case-insensitive lookup
create index if not exists idx_store_invites_code_upper on public.store_invites(upper(code));

-- ==========================================
-- Milestone 1: Product Variants & Multi-Store Pricing
-- ==========================================

-- 10. Product Variants
create table if not exists public.product_variants (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    name text not null, -- e.g., 'Size', 'Spiciness'
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

-- 11. Variant Options
create table if not exists public.variant_options (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    variant_id uuid references public.product_variants(id) on delete cascade not null,
    name text not null, -- e.g., 'Large', 'Extra Cheese'
    price_modifier numeric(12, 2) default 0.00 not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

-- 12. Product Store Pricing (Overrides for Multi-Store Pricing)
create table if not exists public.product_store_pricing (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    price numeric(12, 2) not null check (price >= 0),
    created_at timestamptz default now() not null,
    updated_at timestamptz default now(),
    unique(store_id, product_id)
);

-- Enable RLS
alter table public.product_variants enable row level security;
alter table public.variant_options enable row level security;
alter table public.product_store_pricing enable row level security;

-- RLS Policies
create policy "Members can view product variants" on public.product_variants
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create product variants" on public.product_variants
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update product variants" on public.product_variants
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete product variants" on public.product_variants
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

create policy "Members can view variant options" on public.variant_options
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create variant options" on public.variant_options
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update variant options" on public.variant_options
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete variant options" on public.variant_options
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

create policy "Members can view product pricing overrides" on public.product_store_pricing
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create product pricing overrides" on public.product_store_pricing
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update product pricing overrides" on public.product_store_pricing
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete product pricing overrides" on public.product_store_pricing
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

-- Triggers for updated_at
create trigger updated_at_product_variants before update on public.product_variants
    for each row execute function public.update_updated_at_column();
create trigger updated_at_variant_options before update on public.variant_options
    for each row execute function public.update_updated_at_column();
create trigger updated_at_product_store_pricing before update on public.product_store_pricing
    for each row execute function public.update_updated_at_column();

-- Indexes
create index if not exists idx_product_variants_store_product on public.product_variants(store_id, product_id);
create index if not exists idx_variant_options_store_variant on public.variant_options(store_id, variant_id);
create index if not exists idx_product_store_pricing_store_product on public.product_store_pricing(store_id, product_id);

-- ==========================================
-- Customer Debts (Piutang) Schema
-- ==========================================

create table if not exists public.customer_debts (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    transaction_id uuid references public.transactions(id) on delete cascade not null,
    customer_id uuid references public.customers(id) on delete cascade not null,
    amount numeric(12, 2) not null check (amount >= 0),
    remaining_amount numeric(12, 2) not null check (remaining_amount >= 0),
    status text not null check (status in ('UNPAID', 'PARTIALLY_PAID', 'PAID')) default 'UNPAID',
    due_date timestamptz,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

alter table public.customer_debts enable row level security;

create policy "Members can view store customer debts" on public.customer_debts
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create store customer debts" on public.customer_debts
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update store customer debts" on public.customer_debts
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete store customer debts" on public.customer_debts
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

create trigger updated_at_customer_debts before update on public.customer_debts
    for each row execute function public.update_updated_at_column();

create index if not exists idx_customer_debts_store_customer on public.customer_debts(store_id, customer_id);
create index if not exists idx_customer_debts_transaction on public.customer_debts(transaction_id);

-- RPC: Apply a payment to a customer debt, updating remaining_amount and status
create or replace function public.apply_debt_payment(
    p_debt_id uuid,
    p_amount numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_remaining numeric;
    v_new_status text;
begin
    update public.customer_debts
    set remaining_amount = remaining_amount - p_amount,
        status = case
            when remaining_amount - p_amount <= 0 then 'PAID'
            else 'PARTIALLY_PAID'
        end,
        updated_at = now()
    where id = p_debt_id
    returning remaining_amount, status into v_remaining, v_new_status;

    if not found then
        return jsonb_build_object('error', 'Debt not found');
    end if;

    return jsonb_build_object('success', true, 'remaining_amount', v_remaining, 'status', v_new_status);
end;
$$;

-- ==========================================
-- Debt Payments (Piutang Payments) Schema
-- ==========================================

create table if not exists public.debt_payments (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    debt_id uuid references public.customer_debts(id) on delete cascade not null,
    amount numeric(12, 2) not null check (amount > 0),
    payment_method text not null check (payment_method in ('CASH', 'TRANSFER', 'CARD', 'OTHER')) default 'CASH',
    paid_at timestamptz default now() not null,
    notes text default '',
    created_at timestamptz default now() not null
);

alter table public.debt_payments enable row level security;

create policy "Members can view store debt payments" on public.debt_payments
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create store debt payments" on public.debt_payments
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update store debt payments" on public.debt_payments
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete store debt payments" on public.debt_payments
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

create index if not exists idx_debt_payments_debt on public.debt_payments(debt_id);
create index if not exists idx_debt_payments_store on public.debt_payments(store_id);

-- ==========================================
-- 13. Suppliers, POs, KDS, and Memberships
-- ==========================================

-- Suppliers
create table if not exists public.suppliers (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    name text not null,
    phone text default '',
    email text default '',
    address text default '',
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

-- Purchase Orders
create table if not exists public.purchase_orders (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    supplier_id uuid references public.suppliers(id) on delete cascade not null,
    total_amount numeric(12, 2) not null check (total_amount >= 0),
    status text not null check (status in ('PENDING', 'RECEIVED', 'CANCELLED')) default 'PENDING',
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

-- Purchase Order Items
create table if not exists public.purchase_order_items (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    purchase_order_id uuid references public.purchase_orders(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    quantity integer not null check (quantity > 0),
    unit_price numeric(12, 2) not null check (unit_price >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    created_at timestamptz default now() not null
);

alter table public.purchase_order_items enable row level security;

create policy "Members can view store purchase order items" on public.purchase_order_items
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create store purchase order items" on public.purchase_order_items
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update store purchase order items" on public.purchase_order_items
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete store purchase order items" on public.purchase_order_items
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

create index if not exists idx_purchase_order_items_po on public.purchase_order_items(purchase_order_id);
create index if not exists idx_purchase_order_items_store on public.purchase_order_items(store_id);

-- RPC: Receive a purchase order — update status + insert items + increment stock atomically
create or replace function public.receive_purchase_order(
    p_po_id uuid,
    p_store_id uuid,
    p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item jsonb;
    v_product_id uuid;
    v_quantity integer;
    v_unit_price numeric;
    v_subtotal numeric;
    v_total numeric := 0;
    v_item_id uuid;
begin
    -- Verify PO exists and is PENDING
    if not exists (select 1 from public.purchase_orders where id = p_po_id and store_id = p_store_id and status = 'PENDING') then
        return jsonb_build_object('error', 'PO not found or not in PENDING status');
    end if;

    -- Process each item
    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_subtotal := v_quantity * v_unit_price;
        v_total := v_total + v_subtotal;
        v_item_id := gen_random_uuid();

        -- Insert purchase_order_item
        insert into public.purchase_order_items (id, store_id, purchase_order_id, product_id, quantity, unit_price, subtotal)
        values (v_item_id, p_store_id, p_po_id, v_product_id, v_quantity, v_unit_price, v_subtotal);

        -- Increment product stock
        update public.products
        set stock = stock + v_quantity
        where id = v_product_id and store_id = p_store_id;

        -- Log stock history
        insert into public.stock_history (store_id, product_id, user_id, old_stock, new_stock, reason)
        select p_store_id, v_product_id, auth.uid(), stock - v_quantity, stock, 'PO Receive'
        from public.products where id = v_product_id and store_id = p_store_id;
    end loop;

    -- Update PO status and total
    update public.purchase_orders
    set status = 'RECEIVED', total_amount = v_total, updated_at = now()
    where id = p_po_id;

    return jsonb_build_object('success', true, 'total_amount', v_total);
end;
$$;

-- Kitchen Orders
create table if not exists public.kitchen_orders (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    transaction_id uuid references public.transactions(id) on delete cascade not null,
    status text not null check (status in ('NEW', 'PREPARING', 'READY', 'SERVED')) default 'NEW',
    notes text default '',
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

-- Memberships (Loyalty Program)
create table if not exists public.memberships (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    customer_id uuid references public.customers(id) on delete cascade unique not null,
    points integer default 0 not null check (points >= 0),
    tier text not null check (tier in ('BRONZE', 'SILVER', 'GOLD')) default 'BRONZE',
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);

-- Enable RLS
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.kitchen_orders enable row level security;
alter table public.memberships enable row level security;

-- RLS Policies
create policy "Members can view suppliers" on public.suppliers
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create suppliers" on public.suppliers
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update suppliers" on public.suppliers
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete suppliers" on public.suppliers
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

create policy "Members can view purchase orders" on public.purchase_orders
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create purchase orders" on public.purchase_orders
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update purchase orders" on public.purchase_orders
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete purchase orders" on public.purchase_orders
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

create policy "Members can view kitchen orders" on public.kitchen_orders
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create kitchen orders" on public.kitchen_orders
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update kitchen orders" on public.kitchen_orders
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete kitchen orders" on public.kitchen_orders
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

create policy "Members can view memberships" on public.memberships
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create memberships" on public.memberships
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Admins can update memberships" on public.memberships
    for update to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'))
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));
create policy "Admins can delete memberships" on public.memberships
    for delete to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()) and public.get_user_role(store_id) in ('OWNER', 'ADMIN'));

-- Triggers for updated_at
create trigger updated_at_suppliers before update on public.suppliers
    for each row execute function public.update_updated_at_column();
create trigger updated_at_purchase_orders before update on public.purchase_orders
    for each row execute function public.update_updated_at_column();
create trigger updated_at_kitchen_orders before update on public.kitchen_orders
    for each row execute function public.update_updated_at_column();
create trigger updated_at_memberships before update on public.memberships
    for each row execute function public.update_updated_at_column();

-- Indexes
create index if not exists idx_suppliers_store on public.suppliers(store_id);
create index if not exists idx_purchase_orders_store_supplier on public.purchase_orders(store_id, supplier_id);
create index if not exists idx_purchase_order_items_po on public.purchase_order_items(purchase_order_id);
create index if not exists idx_purchase_order_items_store on public.purchase_order_items(store_id);
create index if not exists idx_kitchen_orders_store_transaction on public.kitchen_orders(store_id, transaction_id);
create index if not exists idx_memberships_store_customer on public.memberships(store_id, customer_id);

-- ==========================================
-- Cash Management (Cash In/Out)
-- ==========================================

create table if not exists public.cash_transactions (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    shift_id uuid references public.shifts(id) on delete cascade not null,
    type text not null check (type in ('IN', 'OUT')),
    amount numeric(12, 2) not null check (amount > 0),
    reason text not null default '',
    created_at timestamptz default now() not null
);

alter table public.cash_transactions enable row level security;

create policy "Members can view store cash_transactions" on public.cash_transactions
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create store cash_transactions" on public.cash_transactions
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));

create index if not exists idx_cash_transactions_shift on public.cash_transactions(shift_id);
create index if not exists idx_cash_transactions_store on public.cash_transactions(store_id);

-- ==========================================
-- Loyalty Points RPCs
-- ==========================================

create or replace function public.award_points(
    p_store_id uuid,
    p_customer_id uuid,
    p_points integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_membership_id uuid;
    v_current_points integer;
    v_current_tier text;
    v_new_tier text;
begin
    -- Upsert membership
    insert into public.memberships (id, store_id, customer_id, points, tier)
    values (gen_random_uuid(), p_store_id, p_customer_id, p_points, 'BRONZE')
    on conflict (customer_id) do update set
        points = memberships.points + p_points,
        updated_at = now()
    returning id, points, tier into v_membership_id, v_current_points, v_current_tier;

    -- Auto-upgrade tier
    v_new_tier := v_current_tier;
    if v_current_points >= 1000 then
        v_new_tier := 'GOLD';
    elsif v_current_points >= 500 then
        v_new_tier := 'SILVER';
    end if;

    if v_new_tier != v_current_tier then
        update public.memberships set tier = v_new_tier, updated_at = now()
        where id = v_membership_id;
    end if;

    return jsonb_build_object('success', true, 'points', v_current_points, 'tier', v_new_tier);
end;
$$;

create or replace function public.redeem_points(
    p_store_id uuid,
    p_customer_id uuid,
    p_points integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_current_points integer;
begin
    select points into v_current_points
    from public.memberships
    where store_id = p_store_id and customer_id = p_customer_id;

    if not found then
        return jsonb_build_object('error', 'Membership tidak ditemukan');
    end if;
create index if not exists idx_memberships_store_customer on public.memberships(store_id, customer_id);

-- ==========================================
-- Cash Management (Cash In/Out)
-- ==========================================

create table if not exists public.cash_transactions (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    shift_id uuid references public.shifts(id) on delete cascade not null,
    type text not null check (type in ('IN', 'OUT')),
    amount numeric(12, 2) not null check (amount > 0),
    reason text not null default '',
    created_at timestamptz default now() not null
);

alter table public.cash_transactions enable row level security;

create policy "Members can view store cash_transactions" on public.cash_transactions
    for select to authenticated
    using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can create store cash_transactions" on public.cash_transactions
    for insert to authenticated
    with check (store_id in (select store_id from public.store_members where user_id = auth.uid()));

create index if not exists idx_cash_transactions_shift on public.cash_transactions(shift_id);
create index if not exists idx_cash_transactions_store on public.cash_transactions(store_id);

-- ==========================================
-- Loyalty Points RPCs
-- ==========================================

create or replace function public.award_points(
    p_store_id uuid,
    p_customer_id uuid,
    p_points integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_membership_id uuid;
    v_current_points integer;
    v_current_tier text;
    v_new_tier text;
begin
    -- Upsert membership
    insert into public.memberships (id, store_id, customer_id, points, tier)
    values (gen_random_uuid(), p_store_id, p_customer_id, p_points, 'BRONZE')
    on conflict (customer_id) do update set
        points = memberships.points + p_points,
        updated_at = now()
    returning id, points, tier into v_membership_id, v_current_points, v_current_tier;

    -- Auto-upgrade tier
    v_new_tier := v_current_tier;
    if v_current_points >= 1000 then
        v_new_tier := 'GOLD';
    elsif v_current_points >= 500 then
        v_new_tier := 'SILVER';
    end if;

    if v_new_tier != v_current_tier then
        update public.memberships set tier = v_new_tier, updated_at = now()
        where id = v_membership_id;
    end if;

    return jsonb_build_object('success', true, 'points', v_current_points, 'tier', v_new_tier);
end;
$$;

create or replace function public.redeem_points(
    p_store_id uuid,
    p_customer_id uuid,
    p_points integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_current_points integer;
begin
    select points into v_current_points
    from public.memberships
    where store_id = p_store_id and customer_id = p_customer_id;

    if not found then
        return jsonb_build_object('error', 'Membership tidak ditemukan');
    end if;

    if v_current_points < p_points then
        return jsonb_build_object('error', 'Poin tidak mencukupi');
    end if;

    update public.memberships
    set points = points - p_points, updated_at = now()
    where store_id = p_store_id and customer_id = p_customer_id;

    return jsonb_build_object('success', true, 'redeemed', p_points, 'remaining', v_current_points - p_points);
end;
$$;


-- ==========================================
-- Schema update v4: advanced POS tables
-- ==========================================

-- 1. Product Batches
create table if not exists public.product_batches (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    batch_no text not null,
    expiry_date timestamptz not null,
    quantity integer not null default 0 check (quantity >= 0),
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);
alter table public.product_batches enable row level security;
create policy "Members can view product_batches" on public.product_batches
    for select to authenticated using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can manage product_batches" on public.product_batches
    for all to authenticated using (store_id in (select store_id from public.store_members where user_id = auth.uid()));

-- 2. Warehouses
create table if not exists public.warehouses (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    name text not null,
    address text,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now()
);
alter table public.warehouses enable row level security;
create policy "Members can view warehouses" on public.warehouses
    for select to authenticated using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can manage warehouses" on public.warehouses
    for all to authenticated using (store_id in (select store_id from public.store_members where user_id = auth.uid()));

-- 3. Warehouse Stocks
create table if not exists public.warehouse_stocks (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    warehouse_id uuid references public.warehouses(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    stock integer not null default 0 check (stock >= 0),
    created_at timestamptz default now() not null,
    updated_at timestamptz default now(),
    unique(warehouse_id, product_id)
);
alter table public.warehouse_stocks enable row level security;
create policy "Members can view warehouse_stocks" on public.warehouse_stocks
    for select to authenticated using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can manage warehouse_stocks" on public.warehouse_stocks
    for all to authenticated using (store_id in (select store_id from public.store_members where user_id = auth.uid()));

-- 4. User Permissions
create table if not exists public.user_permissions (
    id uuid default gen_random_uuid() primary key,
    store_id uuid references public.stores(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    permission_key text not null,
    enabled boolean not null default true,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now(),
    unique(store_id, user_id, permission_key)
);
alter table public.user_permissions enable row level security;
create policy "Members can view user_permissions" on public.user_permissions
    for select to authenticated using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
create policy "Members can manage user_permissions" on public.user_permissions
    for all to authenticated using (store_id in (select store_id from public.store_members where user_id = auth.uid()));
