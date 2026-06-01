/* eslint-disable react-hooks/set-state-in-effect -- Dexie data loading is a valid sync pattern */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, type LocalProduct, type LocalCustomer } from '@/lib/dexie';
import { useMasterDataSync } from '@/hooks/useMasterDataSync';
import { subscribe } from '@/lib/broadcast';

export interface CashierCategory {
  id: string;
  name: string;
}

export function useCashierData(activeStoreId: string | undefined) {
  const { isSyncing } = useMasterDataSync();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [categories, setCategories] = useState<CashierCategory[]>([]);
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const wasSyncingRef = useRef(false);

  const loadDexieData = useCallback(async () => {
    if (!activeStoreId) return;
    try {
      setDataLoading(true);
      const localProducts = await db.products.where('store_id').equals(activeStoreId).toArray();
      const pricingOverrides = await db.productStorePricing.where('store_id').equals(activeStoreId).toArray();
      const overrideMap = new Map(pricingOverrides.map(p => [p.product_id, p.price]));
      setProducts(localProducts.map(p => ({
        ...p,
        price: overrideMap.has(p.id) ? overrideMap.get(p.id)! : p.price
      })));
      const localCategories = await db.categories.where('store_id').equals(activeStoreId).toArray();
      setCategories(localCategories);
      const localCustomers = await db.customers.where('store_id').equals(activeStoreId).toArray();
      setCustomers(localCustomers);
    } catch (err) {
      console.error('Error loading data from Dexie:', err);
    } finally {
      setDataLoading(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    loadDexieData();
  }, [loadDexieData]);

  useEffect(() => {
    if (wasSyncingRef.current && !isSyncing) {
      loadDexieData();
    }
    wasSyncingRef.current = isSyncing;
  }, [isSyncing, loadDexieData]);

  // Reload products when another tab broadcasts a stock update
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'STOCK_UPDATE') {
        loadDexieData();
      }
    });
    return unsub;
  }, [loadDexieData]);

  return { products, categories, customers, dataLoading, loadDexieData };
}
