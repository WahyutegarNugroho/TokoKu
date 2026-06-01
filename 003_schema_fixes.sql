-- ==========================================
-- Migration 003: Schema Fixes & Storage RLS
-- ==========================================
-- Fixes: #36 Storage RLS, #37 JSONB validation,
--         #38 payment_method SPLIT, #39 sync_status default
-- ==========================================

-- ── Fix #39: sync_status default should be false ──
-- New transactions are NOT synced yet, so default must be false
alter table public.transactions alter column sync_status set default false;

-- ── Fix #38: Add 'SPLIT' to payment_method check constraint ──
-- When multiple payment methods are used, the primary method is set to 'SPLIT'
-- for accurate reporting (actual breakdown is in payment_splits table)
alter table public.transactions drop constraint if exists transactions_payment_method_check;
alter table public.transactions add constraint transactions_payment_method_check
    check (payment_method in ('CASH', 'DEBIT', 'QRIS', 'SPLIT'));

-- ── Fix #37: Add JSONB validation constraint for returns.items ──
-- Ensures each item in the JSONB array has required fields:
-- product_id (uuid), quantity (number), refund_amount (number)
alter table public.returns drop constraint if exists returns_items_validation_check;
alter table public.returns add constraint returns_items_validation_check
    check (
        jsonb_typeof(items) = 'array'
        and (
            items = '[]'::jsonb
            or (
                jsonb_array_length(items) > 0
                and not exists (
                    select 1
                    from jsonb_array_elements(items) as elem
                    where
                        elem ? 'product_id' = false
                        or elem ? 'quantity' = false
                        or elem ? 'refund_amount' = false
                        or jsonb_typeof(elem->'quantity') not in ('number')
                        or jsonb_typeof(elem->'refund_amount') not in ('number')
                )
            )
        )
    );

-- ── Fix #36: Storage RLS policies for product-images bucket ──
-- Create bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'product-images',
    'product-images',
    true,
    2097152, -- 2MB
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Policy: Any authenticated user can read product images
create policy "Anyone can read product images"
    on storage.objects for select
    using (bucket_id = 'product-images');

-- Policy: Store members can upload product images
create policy "Store members can upload product images"
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'product-images'
        and exists (
            select 1 from public.store_members
            where user_id = auth.uid()
        )
    );

-- Policy: Only store OWNER/ADMIN can delete product images
create policy "Owner/Admin can delete product images"
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'product-images'
        and exists (
            select 1 from public.store_members
            where user_id = auth.uid()
            and role in ('OWNER', 'ADMIN')
        )
    );

-- Policy: Only store OWNER/ADMIN can update product images
create policy "Owner/Admin can update product images"
    on storage.objects for update
    to authenticated
    using (
        bucket_id = 'product-images'
        and exists (
            select 1 from public.store_members
            where user_id = auth.uid()
            and role in ('OWNER', 'ADMIN')
        )
    );
