-- ==========================================
-- Migration: Security Hardening (Issue #4 & #9)
-- Date: 2026-05-21
-- ==========================================
-- Changes:
-- 1. Add membership check to decrement_product_stock RPC
-- 2. Add membership check to increment_product_stock RPC
-- 3. Add audit logging to create_store_with_membership
-- 4. Add audit logging to delete_store
-- 5. Add audit logging to add_member_direct
-- 6. Add security documentation (comments only, no functional change)
-- ==========================================

-- 1. decrement_product_stock: Add membership check
create or replace function public.decrement_product_stock(
    p_product_id uuid,
    p_quantity int,
    p_store_id uuid,
    p_user_id uuid,
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
    -- Authorization: caller must be a member of the store
    if not public.is_store_member(p_store_id) then
        return jsonb_build_object('error', 'Akses ditolak: bukan anggota toko');
    end if;

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

    v_old_stock := v_new_stock + p_quantity;

    insert into public.stock_history (store_id, product_id, user_id, old_stock, new_stock, reason)
    values (p_store_id, p_product_id, p_user_id, v_old_stock, v_new_stock, p_reason);

    return jsonb_build_object('success', true, 'new_stock', v_new_stock);
end;
$$;

-- 2. increment_product_stock: Add membership check
create or replace function public.increment_product_stock(
    p_product_id uuid,
    p_quantity int,
    p_store_id uuid,
    p_user_id uuid,
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
    -- Authorization: caller must be a member of the store
    if not public.is_store_member(p_store_id) then
        return jsonb_build_object('error', 'Akses ditolak: bukan anggota toko');
    end if;

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
    values (p_store_id, p_product_id, p_user_id, v_old_stock, v_new_stock, p_reason);

    return jsonb_build_object('success', true, 'new_stock', v_new_stock);
end;
$$;

-- 3. create_store_with_membership: Add audit log + server-side UUID generation
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

    -- Audit log
    insert into public.activity_logs (store_id, user_id, action, description)
    values (v_store_id, v_user_id, 'CREATE_STORE', 'Toko ' || p_store_name || ' dibuat');

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

-- 4. delete_store: Add audit log
create or replace function public.delete_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_role text;
    v_store_name text;
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

    select name into v_store_name from public.stores where id = p_store_id;

    -- Audit log before delete
    insert into public.activity_logs (store_id, user_id, action, description)
    values (p_store_id, v_user_id, 'DELETE_STORE', 'Toko ' || coalesce(v_store_name, p_store_id::text) || ' dihapus');

    delete from public.stores where id = p_store_id;

    return jsonb_build_object('success', true);
exception
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;

-- 5. add_member_direct: Add audit log
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

    -- Audit log
    insert into public.activity_logs (store_id, user_id, action, description)
    values (p_store_id, v_caller_id, 'ADD_MEMBER', 'Anggota ' || p_user_email || ' ditambahkan sebagai ' || p_role);

    return jsonb_build_object('success', true, 'user_id', v_target_id);
exception
    when others then
        return jsonb_build_object('error', SQLERRM);
end;
$$;
