'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCartStore } from '@/store/cartStore';
import { printReceipt } from '@/lib/printReceipt';
import { formatShortId } from '@/lib/utils';
import type { LocalProduct } from '@/lib/dexie';

export interface LastTransaction {
  id: string;
  total: number;
  tax: number;
  taxRate: number;
  cashAmount: number;
  paymentMethod: string;
  change: number;
  items: { product: LocalProduct; quantity: number; discount?: number; variants?: { name: string; option: string }[] }[];
  date: string;
  cashierName: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
}

export function useCheckout(activeStoreId: string | undefined, activeShiftId: string | null, profile: { full_name?: string } | null, activeStore: { name: string; address?: string | null; phone?: string | null; tax_enabled?: boolean; tax_rate?: number } | null) {
  const { cart, subtotal, tax, discount, discountAmount, discountType, total, paymentSplits, taxEnabled, taxRate, checkout, setDiscount, setDiscountType, setPaymentSplits, setTaxConfig } = useCartStore();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [changeAmount, setChangeAmount] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<LastTransaction | null>(null);
  const [discountInput, setDiscountInput] = useState('');

  useEffect(() => {
    if (activeStore) {
      setTaxConfig(activeStore.tax_enabled ?? false, activeStore.tax_rate ?? 11);
    }
  }, [activeStore, setTaxConfig]);

  useEffect(() => {
    const cashSplit = paymentSplits.find(s => s.method === 'CASH');
    const cash = cashSplit?.amount || 0;
    const nonCashTotal = paymentSplits.filter(s => s.method !== 'CASH').reduce((a, b) => a + (b.amount || 0), 0);
    const amount = cash > total - nonCashTotal ? cash - (total - nonCashTotal) : null;
    setTimeout(() => setChangeAmount(amount), 0);
  }, [paymentSplits, total]);

  const handlePaymentSplitChange = useCallback((method: 'CASH' | 'DEBIT' | 'QRIS' | 'EWALLET' | 'TRANSFER' | 'CREDIT' | 'DEBT', value: number) => {
    const others = paymentSplits.filter(s => s.method !== method);
    const otherTotal = others.reduce((a, b) => a + (b.amount || 0), 0);
    const clamped = method === 'CASH' ? value : Math.min(value, Math.max(0, total - otherTotal));
    const newSplits = [...others, { method, amount: clamped }].sort((a, b) => a.method.localeCompare(b.method));
    setPaymentSplits(newSplits);
  }, [paymentSplits, total, setPaymentSplits]);

  const submittingRef = useRef(false);

  const handleCheckoutSubmit = useCallback(async () => {
    if (!activeShiftId || !activeStoreId) return;
    if (submittingRef.current) return;
    submittingRef.current = true;

    const nonCashTotal = paymentSplits.filter(s => s.method !== 'CASH').reduce((a, b) => a + (b.amount || 0), 0);
    if (nonCashTotal > total) { setCheckoutError('Jumlah pembayaran non-tunai melebihi total tagihan.'); return; }
    const splitTotal = paymentSplits.reduce((sum, s) => sum + (s.amount || 0), 0);
    if (splitTotal < total) { setCheckoutError('Jumlah pembayaran kurang dari total tagihan.'); return; }
    const nonZero = paymentSplits.filter(s => s.amount > 0);
    if (nonZero.length === 0) { setCheckoutError('Pilih minimal satu metode pembayaran.'); return; }

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      const transCart = [...cart];
      const primaryMethod = nonZero[0].method;
      const cashSplit = paymentSplits.find(s => s.method === 'CASH');
      const cashAmount = cashSplit?.amount || 0;
      const change = cashSplit ? (cashAmount - Math.max(0, total - paymentSplits.filter(s => s.method !== 'CASH').reduce((a, b) => a + b.amount, 0))) : 0;
      const capturedCashAmount = cashAmount;

      const transactionId = await checkout(activeStoreId, activeShiftId);

      setLastTransaction({
        id: transactionId,
        total,
        tax,
        taxRate,
        cashAmount: capturedCashAmount,
        paymentMethod: nonZero.length === 1 ? primaryMethod : paymentSplits.filter(s => s.amount > 0).map(s => s.method + ': Rp' + s.amount.toLocaleString('id-ID')).join(', '),
        change: Math.max(0, change),
        items: transCart,
        date: new Date().toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        cashierName: profile?.full_name || 'Kasir',
        storeName: activeStore?.name || 'TokoKu',
        storeAddress: activeStore?.address || '',
        storePhone: activeStore?.phone || '',
      });

      setShowPaymentModal(false);
      setChangeAmount(null);
      setDiscountInput('');
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Gagal memproses pembayaran.');
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [activeShiftId, activeStoreId, paymentSplits, total, cart, checkout, tax, taxRate, profile, activeStore]);

  const handlePrintReceipt = useCallback(() => {
    if (!lastTransaction) return;
    const cashAmount = lastTransaction.cashAmount;
    printReceipt(
      lastTransaction.storeName,
      lastTransaction.storeAddress,
      lastTransaction.storePhone,
      lastTransaction.date,
      formatShortId(lastTransaction.id),
      lastTransaction.cashierName,
      lastTransaction.items.map(i => ({ name: i.product.name, quantity: i.quantity, total: i.product.price * i.quantity - (i.discount ?? 0) })),
      lastTransaction.tax,
      lastTransaction.total,
      cashAmount,
      lastTransaction.change,
      lastTransaction.paymentMethod,
      lastTransaction.taxRate,
    );
  }, [lastTransaction]);

  return {
    cart, subtotal, tax, discount, discountAmount, discountType, total, paymentSplits, taxEnabled, taxRate,
    showPaymentModal, setShowPaymentModal, changeAmount, checkoutError, setCheckoutError, isSubmitting, lastTransaction, setLastTransaction,
    discountInput, setDiscountInput,
    handlePaymentSplitChange, handleCheckoutSubmit, handlePrintReceipt,
    setDiscount, setDiscountType,
  };
}
