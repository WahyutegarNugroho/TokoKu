-- ==========================================
-- Migration 005: Index sync_status + RLS hardening
-- ==========================================
-- Fixes: #29 activity_logs RLS (role-gated actions),
--         #30 partial index on transactions.sync_status
-- ==========================================

-- ── Fix #29: Ketatkan RLS activity_logs ──
-- Hanya OWNER/ADMIN yang bisa insert non-CRUD actions
drop policy if exists "Users can create activity logs" on public.activity_logs;

create policy "Users can create activity logs" on public.activity_logs
  for insert to authenticated
  with check (
    store_id in (select store_id from public.store_members where user_id = auth.uid())
    and (
      action in ('CHECKOUT', 'REFUND', 'SHIFT_OPEN', 'SHIFT_CLOSE')
      or
      exists (
        select 1 from public.store_members
        where user_id = auth.uid() and store_id = activity_logs.store_id and role in ('OWNER', 'ADMIN')
      )
    )
  );

-- ── Fix #30: Partial index untuk sync engine ──
create index if not exists idx_transactions_sync_status
  on public.transactions(sync_status)
  where sync_status = false;
