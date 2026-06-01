-- ==========================================
-- Migration 006: Race condition + RLS/RPC fixes
-- ==========================================
-- Fixes: #57 insert member before increment invite,
--         #59 UPDATE RLS store_members + change_member_role RPC
-- ==========================================

-- ── Fix #57: Reorder join_store_with_invite — insert member FIRST ──
-- Prevents wasting invite usage when duplicate membership is rejected
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

    -- Insert membership FIRST to avoid wasting invite usage on duplicate
    insert into public.store_members (store_id, user_id, role)
    values (v_invite.store_id, v_user_id, v_invite.role);

    -- Only then increment used_count
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

-- ── Fix #59: UPDATE RLS policy on store_members ──
drop policy if exists "Owner can update members" on public.store_members;
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

-- ── Fix #59: RPC change_member_role — OWNER-only role change ──
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
