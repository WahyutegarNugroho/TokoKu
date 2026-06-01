'use client';

import { useState, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { useCartStore } from '@/store/cartStore';
import { useToastStore } from '@/store/toastStore';

const TX_PAGE_SIZE = 20;

export interface HistoryTxItem {
  product_name: string;
  quantity: number;
  subtotal: number;
}

export interface HistoryTx {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  items: HistoryTxItem[];
}

interface FetchTxPageResult {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  items: HistoryTxItem[];
}

export function useTransactionHistory(activeStoreId: string | undefined) {
  const { refundTransaction } = useCartStore();
  const [showTxHistory, setShowTxHistory] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState<HistoryTx[]>([]);
  const [txPage, setTxPage] = useState(0);
  const [txTotalCount, setTxTotalCount] = useState(0);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundTx, setRefundTx] = useState<HistoryTx | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundQtys, setRefundQtys] = useState<number[]>([]);

  const fetchTxPage = useCallback(async (storeId: string, page: number, pageSize: number): Promise<FetchTxPageResult[]> => {
    const txs = await db.transactions
      .where('store_id').equals(storeId)
      .reverse()
      .offset(page * pageSize)
      .limit(pageSize)
      .toArray();

    const txIds = txs.map(tx => tx.id);
    const items = txIds.length > 0
      ? await db.transactionItems.where('transaction_id').anyOf(txIds).toArray()
      : [];
    const productIds = [...new Set(items.map(i => i.product_id))];
    const prods = productIds.length > 0 ? await db.products.where('id').anyOf(productIds).toArray() : [];
    const prodMap = new Map(prods.map(p => [p.id, p.name]));

    return txs.map(tx => ({
      id: tx.id,
      total_amount: tx.total_amount,
      payment_method: tx.payment_method,
      status: tx.status || 'COMPLETED',
      created_at: tx.created_at,
      items: items.filter(i => i.transaction_id === tx.id).map(i => ({
        product_name: prodMap.get(i.product_id) || 'Unknown',
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
    }));
  }, []);

  const loadTransactionHistory = useCallback(async () => {
    if (!activeStoreId) return;
    const totalCount = await db.transactions.where('store_id').equals(activeStoreId).count();
    setTxTotalCount(totalCount);
    setTxPage(0);
    const pageData = await fetchTxPage(activeStoreId, 0, TX_PAGE_SIZE);
    setTransactionHistory(pageData);
  }, [activeStoreId, fetchTxPage]);

  const handleLoadMoreTx = useCallback(async () => {
    if (!activeStoreId) return;
    const nextPage = txPage + 1;
    setTxPage(nextPage);
    const pageData = await fetchTxPage(activeStoreId, nextPage, TX_PAGE_SIZE);
    setTransactionHistory(prev => [...prev, ...pageData]);
  }, [activeStoreId, txPage, fetchTxPage]);

  const handleRefund = useCallback(async () => {
    if (!refundTx || !activeStoreId || !refundReason.trim()) return;
    setRefunding(true);
    try {
      const items = await db.transactionItems.where('transaction_id').equals(refundTx.id).toArray();
      const refundItems = items
        .map((item, i) => {
          const refundQty = refundQtys[i] ?? item.quantity;
          if (refundQty <= 0) return null;
          const unitPrice = item.quantity > 0 ? item.subtotal / item.quantity : 0;
          return { product_id: item.product_id, quantity: refundQty, refund_amount: unitPrice * refundQty };
        })
        .filter(Boolean) as { product_id: string; quantity: number; refund_amount: number }[];
      if (refundItems.length === 0) throw new Error('Pilih minimal satu item untuk direfund.');
      await refundTransaction(activeStoreId, refundTx.id, refundItems, refundReason.trim());
      setShowRefundModal(false);
      setRefundTx(null);
      setRefundReason('');
      setRefundQtys([]);
      setTxPage(0);
      const txTotalCount = await db.transactions.where('store_id').equals(activeStoreId).count();
      setTxTotalCount(txTotalCount);
      const pageData = await fetchTxPage(activeStoreId, 0, TX_PAGE_SIZE);
      setTransactionHistory(pageData);
    } catch (err) {
      useToastStore.getState().addToast(
        err instanceof Error ? err.message : 'Terjadi kesalahan',
        'error'
      );
    } finally { setRefunding(false); }
  }, [refundTx, activeStoreId, refundReason, refundQtys, refundTransaction, fetchTxPage]);

  return {
    showTxHistory, setShowTxHistory,
    transactionHistory, txTotalCount,
    showRefundModal, setShowRefundModal,
    refundTx, setRefundTx,
    refundReason, setRefundReason,
    refunding, refundQtys, setRefundQtys,
    loadTransactionHistory, handleLoadMoreTx, handleRefund,
  };
}
