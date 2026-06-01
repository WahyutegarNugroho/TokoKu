-- ==========================================
-- Migration 004: Critical Security Fixes
-- ==========================================
-- Fixes: #2 XSS (client-side), #3 RLS bypass,
--         #4 race condition, #54 hardcoded tax rate
-- ==========================================

-- ── Fix #3: Drop old 4-param version (with p_store_id) ──
DROP FUNCTION IF EXISTS public.create_store_with_membership(
    p_store_id uuid,
    p_store_name text,
    p_store_address text,
    p_store_phone text
);

-- ── Fix #3: create_store_with_membership — generate UUID server-side ──
-- Prevents caller from supplying pre-determined UUID (collision attack)
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

-- ── Fix #4: join_store_with_invite — atomic used_count increment ──
-- Prevents race condition where concurrent requests could exceed max_uses
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

    -- Atomic increment with validation: only increment if under max_uses
    update public.store_invites
    set used_count = used_count + 1
    where id = v_invite.id
      and used_count < v_invite.max_uses
    returning id into v_updated_id;

    if not found then
        return jsonb_build_object('error', 'Kode undangan sudah mencapai batas pemakaian.');
    end if;

    insert into public.store_members (store_id, user_id, role)
    values (v_invite.store_id, v_user_id, v_invite.role);

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
