-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Table (extends Supabase auth.users)
create table public.users (
    id uuid references auth.users on delete cascade primary key,
    email text not null,
    role text not null check (role in ('ADMIN', 'KASIR')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Categories Table
create table public.categories (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Products Table
create table public.products (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    sku text not null unique,
    price numeric(12, 2) not null check (price >= 0),
    category_id uuid references public.categories(id) on delete set null,
    stock integer not null default 0 check (stock >= 0),
    image_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Shifts Table
create table public.shifts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    start_time timestamp with time zone default timezone('utc'::text, now()) not null,
    end_time timestamp with time zone,
    status text not null check (status in ('OPEN', 'CLOSED')) default 'OPEN',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Transactions Table
create table public.transactions (
    id uuid default gen_random_uuid() primary key,
    shift_id uuid references public.shifts(id) on delete cascade not null,
    total_amount numeric(12, 2) not null check (total_amount >= 0),
    tax numeric(12, 2) not null check (tax >= 0),
    payment_method text not null check (payment_method in ('CASH', 'DEBIT', 'QRIS')),
    sync_status boolean not null default true, -- true when stored/synced to supabase directly
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Transaction Items Table
create table public.transaction_items (
    id uuid default gen_random_uuid() primary key,
    transaction_id uuid references public.transactions(id) on delete cascade not null,
    product_id uuid references public.products(id) on delete cascade not null,
    quantity integer not null check (quantity > 0),
    price numeric(12, 2) not null check (price >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.shifts enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

-- Setup RLS Policies (Allow all authenticated users full access)
create policy "Allow full access for authenticated users to users" on public.users
    for all to authenticated using (true) with check (true);

create policy "Allow full access for authenticated users to categories" on public.categories
    for all to authenticated using (true) with check (true);

create policy "Allow full access for authenticated users to products" on public.products
    for all to authenticated using (true) with check (true);

create policy "Allow full access for authenticated users to shifts" on public.shifts
    for all to authenticated using (true) with check (true);

create policy "Allow full access for authenticated users to transactions" on public.transactions
    for all to authenticated using (true) with check (true);

create policy "Allow full access for authenticated users to transaction_items" on public.transaction_items
    for all to authenticated using (true) with check (true);

-- Insert dummy data or a trigger to handle new auth users automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'KASIR');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
