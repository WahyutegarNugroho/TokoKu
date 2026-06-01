'use client';

import { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import { db } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { subscribe } from '@/lib/broadcast';

export function useMasterDataSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { activeStore } = useAuthStore();
  const syncedRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  const syncMasterData = useCallback(async () => {
    if (!navigator.onLine || !activeStore) return;

    setIsSyncing(true);
    setError(null);

    try {
      // 1. Fetch ALL categories first, then replace atomically
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('store_id', activeStore.id);

      if (catError) throw catError;

      // Only replace if fetch succeeded — never delete local data on fetch failure
      if (categories) {
        await db.transaction('rw', db.categories, async () => {
          const newCategories = categories.map((cat) => ({
            id: cat.id,
            store_id: cat.store_id,
            name: cat.name,
            description: cat.description,
          }));
          await db.categories.bulkPut(newCategories);
          const newIds = new Set(newCategories.map(c => c.id));
          const existing = await db.categories.where('store_id').equals(activeStore.id).toArray();
          const toDelete = existing.filter(c => !newIds.has(c.id)).map(c => c.id);
          if (toDelete.length > 0) {
            await db.categories.bulkDelete(toDelete);
          }
        });
      }

      // 2. Fetch ALL products first, then replace atomically
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', activeStore.id);

      if (prodError) throw prodError;

      if (products) {
        await db.transaction('rw', db.products, async () => {
          const newProducts = products.map((prod) => ({
            id: prod.id,
            store_id: prod.store_id,
            name: prod.name,
            sku: prod.sku,
            price: Number(prod.price),
            category_id: prod.category_id,
            stock: Number(prod.stock),
            image_url: prod.image_url,
          }));
          await db.products.bulkPut(newProducts);
          const newIds = new Set(newProducts.map(p => p.id));
          const existing = await db.products.where('store_id').equals(activeStore.id).toArray();
          const toDelete = existing.filter(p => !newIds.has(p.id)).map(p => p.id);
          if (toDelete.length > 0) {
            await db.products.bulkDelete(toDelete);
          }
        });
      }

      // 3. Fetch ALL customers first, then replace atomically
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', activeStore.id);

      if (custError) throw custError;

      if (customers) {
        await db.transaction('rw', db.customers, async () => {
          const newCustomers = customers.map((c) => ({
            id: c.id,
            store_id: c.store_id,
            name: c.name,
            phone: c.phone || '',
            email: c.email || '',
            created_at: c.created_at,
          }));
          await db.customers.bulkPut(newCustomers);
          const newIds = new Set(newCustomers.map(c => c.id));
          const existing = await db.customers.where('store_id').equals(activeStore.id).toArray();
          const toDelete = existing.filter(c => !newIds.has(c.id)).map(c => c.id);
          if (toDelete.length > 0) {
            await db.customers.bulkDelete(toDelete);
          }
        });
      }

      // 4. Fetch ALL product variants first, then replace atomically
      try {
        const { data: variants, error: varError } = await supabase
          .from('product_variants')
          .select('*')
          .eq('store_id', activeStore.id);

        if (varError) throw varError;

        if (variants) {
          await db.transaction('rw', db.productVariants, async () => {
            const newVariants = variants.map((v) => ({
              id: v.id,
              store_id: v.store_id,
              product_id: v.product_id,
              name: v.name,
              created_at: v.created_at,
              updated_at: v.updated_at,
            }));
            await db.productVariants.bulkPut(newVariants);
            const newIds = new Set(newVariants.map(v => v.id));
            const existing = await db.productVariants.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(v => !newIds.has(v.id)).map(v => v.id);
            if (toDelete.length > 0) {
              await db.productVariants.bulkDelete(toDelete);
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional product_variants sync (table may not exist):', err);
      }

      // 5. Fetch ALL variant options first, then replace atomically
      try {
        const { data: options, error: optError } = await supabase
          .from('variant_options')
          .select('*')
          .eq('store_id', activeStore.id);

        if (optError) throw optError;

        if (options) {
          await db.transaction('rw', db.variantOptions, async () => {
            const newOptions = options.map((o) => ({
              id: o.id,
              store_id: o.store_id,
              variant_id: o.variant_id,
              name: o.name,
              price_modifier: Number(o.price_modifier),
              created_at: o.created_at,
              updated_at: o.updated_at,
            }));
            await db.variantOptions.bulkPut(newOptions);
            const newIds = new Set(newOptions.map(o => o.id));
            const existing = await db.variantOptions.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(o => !newIds.has(o.id)).map(o => o.id);
            if (toDelete.length > 0) {
              await db.variantOptions.bulkDelete(toDelete);
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional variant_options sync (table may not exist):', err);
      }

      // 6. Fetch ALL product store pricing overrides first, then replace atomically
      try {
        const { data: pricing, error: pricingError } = await supabase
          .from('product_store_pricing')
          .select('*')
          .eq('store_id', activeStore.id);

        if (pricingError) throw pricingError;

        if (pricing) {
          await db.transaction('rw', db.productStorePricing, async () => {
            const newPricing = pricing.map((p) => ({
              id: p.id,
              store_id: p.store_id,
              product_id: p.product_id,
              price: Number(p.price),
              created_at: p.created_at,
              updated_at: p.updated_at,
            }));
            await db.productStorePricing.bulkPut(newPricing);
            const newIds = new Set(newPricing.map(p => p.id));
            const existing = await db.productStorePricing.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(p => !newIds.has(p.id)).map(p => p.id);
            if (toDelete.length > 0) {
              await db.productStorePricing.bulkDelete(toDelete);
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional product_store_pricing sync (table may not exist):', err);
      }

      // 7. Fetch ALL suppliers first, then replace atomically
      try {
        const { data: suppliers, error: supError } = await supabase
          .from('suppliers')
          .select('*')
          .eq('store_id', activeStore.id);

        if (supError) throw supError;

        if (suppliers) {
          await db.transaction('rw', db.suppliers, async () => {
            const newSuppliers = suppliers.map((s) => ({
              id: s.id,
              store_id: s.store_id,
              name: s.name,
              phone: s.phone || '',
              email: s.email || '',
              address: s.address || '',
            }));
            await db.suppliers.bulkPut(newSuppliers);
            const newIds = new Set(newSuppliers.map(s => s.id));
            const existing = await db.suppliers.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(s => !newIds.has(s.id)).map(s => s.id);
            if (toDelete.length > 0) {
              await db.suppliers.bulkDelete(toDelete);
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional suppliers sync (table may not exist):', err);
      }

      // 8. Fetch ALL kitchen orders first, then replace atomically
      try {
        const { data: kitchenOrders, error: kdsError } = await supabase
          .from('kitchen_orders')
          .select('*')
          .eq('store_id', activeStore.id);

        if (kdsError) throw kdsError;

        if (kitchenOrders) {
          await db.transaction('rw', db.kitchenOrders, async () => {
            const newOrders = kitchenOrders.map((k) => ({
              id: k.id,
              store_id: k.store_id,
              transaction_id: k.transaction_id,
              status: k.status as 'NEW' | 'PREPARING' | 'READY' | 'SERVED',
              notes: k.notes || '',
              created_at: k.created_at,
            }));
            await db.kitchenOrders.bulkPut(newOrders);
            const newIds = new Set(newOrders.map(k => k.id));
            const existing = await db.kitchenOrders.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(k => !newIds.has(k.id)).map(k => k.id);
            if (toDelete.length > 0) {
              await db.kitchenOrders.bulkDelete(toDelete);
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional kitchen_orders sync (table may not exist):', err);
      }

      // 9. Fetch ALL memberships first, then replace atomically
      try {
        const { data: memberships, error: memError } = await supabase
          .from('memberships')
          .select('*')
          .eq('store_id', activeStore.id);

        if (memError) throw memError;

        if (memberships) {
          await db.transaction('rw', db.memberships, async () => {
            const newMemberships = memberships.map((m) => ({
              id: m.id,
              store_id: m.store_id,
              customer_id: m.customer_id,
              points: m.points,
              tier: m.tier as 'BRONZE' | 'SILVER' | 'GOLD',
            }));
            await db.memberships.bulkPut(newMemberships);
            const newIds = new Set(newMemberships.map(m => m.id));
            const existing = await db.memberships.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(m => !newIds.has(m.id)).map(m => m.id);
            if (toDelete.length > 0) {
              await db.memberships.bulkDelete(toDelete);
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional memberships sync (table may not exist):', err);
      }

      console.log('Master data synced successfully from Supabase to Dexie.');
    } catch (err) {
      console.error('Error syncing master data to Dexie:', err instanceof Error ? err.message : JSON.stringify(err));
      setError(err instanceof Error ? err.message : 'Gagal sinkronisasi data master.');
    } finally {
      setIsSyncing(false);
    }
  }, [activeStore]);

  // Listen for stock updates from other tabs via BroadcastChannel
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'STOCK_UPDATE') {
        const { productId, newStock } = msg.payload as { productId: string; newStock: number };
        db.products.update(productId, { stock: newStock }).catch(() => {});
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeStore) return;
    syncedRef.current = activeStore.id;
    mountedRef.current = true;
    startTransition(() => { syncMasterData(); });

    // Periodic refresh every 60 seconds so cashier sees new products/categories
    const interval = setInterval(() => {
      startTransition(() => { syncMasterData(); });
    }, 60000);

    return () => clearInterval(interval);
  }, [activeStore, syncMasterData]);

  return { syncMasterData, isSyncing, error };
}
