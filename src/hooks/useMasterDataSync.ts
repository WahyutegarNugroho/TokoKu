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

  const syncMasterData = useCallback(async (isFullForce = false) => {
    if (!navigator.onLine || !activeStore) return;

    setIsSyncing(true);
    setError(null);

    const lastSyncKey = `last_master_sync_${activeStore.id}`;
    const lastSyncVal = isFullForce ? null : localStorage.getItem(lastSyncKey);
    const syncStartTime = new Date().toISOString();

    const fetchDelta = async (table: string) => {
      let query = supabase.from(table).select('*').eq('store_id', activeStore.id);
      if (lastSyncVal) {
        query = query.gt('updated_at', lastSyncVal);
      }
      const result = await query;
      if (result.error && lastSyncVal) {
        // Fallback to full fetch if updated_at filter fails or table lacks column
        return await supabase.from(table).select('*').eq('store_id', activeStore.id);
      }
      return result;
    };

    try {
      // 1. Fetch categories
      const { data: categories, error: catError } = await fetchDelta('categories');
      if (catError) throw catError;

      if (categories) {
        await db.transaction('rw', db.categories, async () => {
          const newCategories = categories.map((cat) => ({
            id: cat.id,
            store_id: cat.store_id,
            name: cat.name,
            description: cat.description,
          }));
          await db.categories.bulkPut(newCategories);

          if (!lastSyncVal) {
            const newIds = new Set(newCategories.map(c => c.id));
            const existing = await db.categories.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(c => !newIds.has(c.id)).map(c => c.id);
            if (toDelete.length > 0) {
              await db.categories.bulkDelete(toDelete);
            }
          }
        });
      }

      // 2. Fetch products
      const { data: products, error: prodError } = await fetchDelta('products');
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

          if (!lastSyncVal) {
            const newIds = new Set(newProducts.map(p => p.id));
            const existing = await db.products.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(p => !newIds.has(p.id)).map(p => p.id);
            if (toDelete.length > 0) {
              await db.products.bulkDelete(toDelete);
            }
          }
        });
      }

      // 3. Fetch customers
      const { data: customers, error: custError } = await fetchDelta('customers');
      if (custError) throw custError;

      if (customers) {
        await db.transaction('rw', db.customers, async () => {
          const newCustomers = customers.map((c) => ({
            id: c.id,
            store_id: c.store_id,
            name: c.name,
            phone: c.phone || '',
            email: c.email || '',
            credit_limit: c.credit_limit || 0,
            created_at: c.created_at,
          }));
          await db.customers.bulkPut(newCustomers);

          if (!lastSyncVal) {
            const newIds = new Set(newCustomers.map(c => c.id));
            const existing = await db.customers.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(c => !newIds.has(c.id)).map(c => c.id);
            if (toDelete.length > 0) {
              await db.customers.bulkDelete(toDelete);
            }
          }
        });
      }

      // 4. Fetch promotions
      const { data: promotions, error: promoError } = await fetchDelta('promotions');
      if (promoError) throw promoError;

      if (promotions) {
        await db.transaction('rw', db.promotions, async () => {
          const newPromotions = promotions.map((p) => ({
            id: p.id,
            store_id: p.store_id,
            name: p.name,
            description: p.description || undefined,
            type: p.type as 'PERCENT' | 'FIXED',
            value: Number(p.value),
            start_date: p.start_date,
            end_date: p.end_date,
            enabled: p.enabled,
          }));
          await db.promotions.bulkPut(newPromotions);

          if (!lastSyncVal) {
            const newIds = new Set(newPromotions.map(p => p.id));
            const existing = await db.promotions.where('store_id').equals(activeStore.id).toArray();
            const toDelete = existing.filter(p => !newIds.has(p.id)).map(p => p.id);
            if (toDelete.length > 0) {
              await db.promotions.bulkDelete(toDelete);
            }
          }
        });
      }

      // 5. Fetch product variants
      try {
        const { data: variants, error: varError } = await fetchDelta('product_variants');
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

            if (!lastSyncVal) {
              const newIds = new Set(newVariants.map(v => v.id));
              const existing = await db.productVariants.where('store_id').equals(activeStore.id).toArray();
              const toDelete = existing.filter(v => !newIds.has(v.id)).map(v => v.id);
              if (toDelete.length > 0) {
                await db.productVariants.bulkDelete(toDelete);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional product_variants sync:', err);
      }

      // 6. Fetch variant options
      try {
        const { data: options, error: optError } = await fetchDelta('variant_options');
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

            if (!lastSyncVal) {
              const newIds = new Set(newOptions.map(o => o.id));
              const existing = await db.variantOptions.where('store_id').equals(activeStore.id).toArray();
              const toDelete = existing.filter(o => !newIds.has(o.id)).map(o => o.id);
              if (toDelete.length > 0) {
                await db.variantOptions.bulkDelete(toDelete);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional variant_options sync:', err);
      }

      // 7. Fetch product store pricing overrides
      try {
        const { data: pricing, error: pricingError } = await fetchDelta('product_store_pricing');
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

            if (!lastSyncVal) {
              const newIds = new Set(newPricing.map(p => p.id));
              const existing = await db.productStorePricing.where('store_id').equals(activeStore.id).toArray();
              const toDelete = existing.filter(p => !newIds.has(p.id)).map(p => p.id);
              if (toDelete.length > 0) {
                await db.productStorePricing.bulkDelete(toDelete);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional product_store_pricing sync:', err);
      }

      // 8. Fetch suppliers
      try {
        const { data: suppliers, error: supError } = await fetchDelta('suppliers');
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

            if (!lastSyncVal) {
              const newIds = new Set(newSuppliers.map(s => s.id));
              const existing = await db.suppliers.where('store_id').equals(activeStore.id).toArray();
              const toDelete = existing.filter(s => !newIds.has(s.id)).map(s => s.id);
              if (toDelete.length > 0) {
                await db.suppliers.bulkDelete(toDelete);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional suppliers sync:', err);
      }

      // 9. Fetch kitchen orders
      try {
        const { data: kitchenOrders, error: kdsError } = await fetchDelta('kitchen_orders');
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

            if (!lastSyncVal) {
              const newIds = new Set(newOrders.map(k => k.id));
              const existing = await db.kitchenOrders.where('store_id').equals(activeStore.id).toArray();
              const toDelete = existing.filter(k => !newIds.has(k.id)).map(k => k.id);
              if (toDelete.length > 0) {
                await db.kitchenOrders.bulkDelete(toDelete);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional kitchen_orders sync:', err);
      }

      // 10. Fetch memberships
      try {
        const { data: memberships, error: memError } = await fetchDelta('memberships');
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

            if (!lastSyncVal) {
              const newIds = new Set(newMemberships.map(m => m.id));
              const existing = await db.memberships.where('store_id').equals(activeStore.id).toArray();
              const toDelete = existing.filter(m => !newIds.has(m.id)).map(m => m.id);
              if (toDelete.length > 0) {
                await db.memberships.bulkDelete(toDelete);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional memberships sync:', err);
      }

      // 11. Fetch customer debts
      try {
        const { data: customerDebts, error: debtError } = await fetchDelta('customer_debts');
        if (debtError) throw debtError;

        if (customerDebts) {
          await db.transaction('rw', db.customerDebts, async () => {
            const newDebts = customerDebts.map((d) => ({
              id: d.id,
              store_id: d.store_id,
              transaction_id: d.transaction_id,
              customer_id: d.customer_id,
              amount: Number(d.amount),
              remaining_amount: Number(d.remaining_amount),
              status: d.status as 'UNPAID' | 'PARTIALLY_PAID' | 'PAID',
              due_date: d.due_date,
              created_at: d.created_at,
              updated_at: d.updated_at,
            }));
            await db.customerDebts.bulkPut(newDebts);

            if (!lastSyncVal) {
              const newIds = new Set(newDebts.map(d => d.id));
              const existing = await db.customerDebts.where('store_id').equals(activeStore.id).toArray();
              const toDelete = existing.filter(d => !newIds.has(d.id)).map(d => d.id);
              if (toDelete.length > 0) {
                await db.customerDebts.bulkDelete(toDelete);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional customer_debts sync:', err);
      }

      // 12. Fetch purchase orders
      try {
        const { data: purchaseOrders, error: poError } = await fetchDelta('purchase_orders');
        if (poError) throw poError;

        if (purchaseOrders) {
          await db.transaction('rw', db.purchaseOrders, async () => {
            const newOrders = purchaseOrders.map((o) => ({
              id: o.id,
              store_id: o.store_id,
              supplier_id: o.supplier_id,
              total_amount: Number(o.total_amount),
              status: o.status as 'PENDING' | 'RECEIVED' | 'CANCELLED',
              created_at: o.created_at,
            }));
            await db.purchaseOrders.bulkPut(newOrders);

            if (!lastSyncVal) {
              const newIds = new Set(newOrders.map(o => o.id));
              const existing = await db.purchaseOrders.where('store_id').equals(activeStore.id).toArray();
              const toDelete = existing.filter(o => !newIds.has(o.id)).map(o => o.id);
              if (toDelete.length > 0) {
                await db.purchaseOrders.bulkDelete(toDelete);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Skipping optional purchase_orders sync:', err);
      }

      // Sync successful - save sync start time to localStorage
      localStorage.setItem(lastSyncKey, syncStartTime);
      console.log(`Master data delta sync (${lastSyncVal ? 'Incremental' : 'Full'}) completed successfully.`);
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
    const isInitial = syncedRef.current !== activeStore.id;
    syncedRef.current = activeStore.id;
    mountedRef.current = true;
    startTransition(() => { syncMasterData(isInitial); });

    // Periodic refresh every 60 seconds so cashier sees new products/categories
    const interval = setInterval(() => {
      startTransition(() => { syncMasterData(false); });
    }, 60000);

    return () => clearInterval(interval);
  }, [activeStore, syncMasterData]);

  return { syncMasterData, isSyncing, error };
}
