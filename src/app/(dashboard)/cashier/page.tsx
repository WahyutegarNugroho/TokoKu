'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useDebounce } from '@/hooks/useDebounce';
import { db } from '@/lib/dexie';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useShiftStore } from '@/store/shiftStore';
import { subscribe } from '@/lib/broadcast';
import { useToastStore } from '@/store/toastStore';
import { useSyncEngine } from '@/hooks/useSyncEngine';
import { useCashierData } from '@/hooks/useCashierData';
import { useCheckout } from '@/hooks/useCheckout';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { Search, RefreshCw, Store, AlertTriangle } from 'lucide-react';
import type { LocalProduct, LocalCustomer } from '@/lib/dexie';
import { CustomerPickerModal, ProductGrid, CartPanel, ShiftSummaryModal, HeldCartsModal, VariantSelectorModal } from '@/components/cashier';

const PaymentModal = dynamic(() => import('@/components/cashier').then(m => m.PaymentModal), { ssr: false });
const ReceiptModal = dynamic(() => import('@/components/cashier').then(m => m.ReceiptModal), { ssr: false });
const TransactionHistoryModal = dynamic(() => import('@/components/cashier').then(m => m.TransactionHistoryModal), { ssr: false });
const RefundModal = dynamic(() => import('@/components/cashier').then(m => m.RefundModal), { ssr: false });

export default function CashierPage() {
  const { user, profile, activeStore } = useAuthStore();
  const { triggerSyncNow } = useSyncEngine();
  const { cart, addToCart, updateQuantity, removeFromCart, clearCart, setCustomerId, setItemDiscount, holdCart, recallCart } = useCartStore();
  const { activeShiftId, initialize, openShift, closeShift, loading: shiftLoading } = useShiftStore();

  const { products, categories, customers, dataLoading } = useCashierData(activeStore?.id);
  const {
    subtotal, discount, discountAmount, discountType, total, paymentSplits, tax, taxEnabled, taxRate,
    showPaymentModal, setShowPaymentModal, changeAmount, checkoutError, setCheckoutError, isSubmitting, lastTransaction, setLastTransaction,
    discountInput, setDiscountInput,
    handlePaymentSplitChange, handleCheckoutSubmit, handlePrintReceipt,
    setDiscount, setDiscountType,
  } = useCheckout(activeStore?.id, activeShiftId, profile, activeStore);
  const {
    showTxHistory, setShowTxHistory, transactionHistory, txTotalCount, loadTransactionHistory,
    handleLoadMoreTx, showRefundModal, setShowRefundModal, refundTx, setRefundTx,
    refundReason, setRefundReason, refunding, refundQtys, setRefundQtys, handleRefund,
  } = useTransactionHistory(activeStore?.id);

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [showHeldCarts, setShowHeldCarts] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  const [selectedVariantProduct, setSelectedVariantProduct] = useState<LocalProduct | null>(null);
  const [showVariantModal, setShowVariantModal] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const prevStoreIdRef = useRef<string | null>(null);

  const handleUpdateQuantity = (cartItemId: string, amount: number) => {
    try {
      updateQuantity(cartItemId, amount);
    } catch (err: unknown) {
      useToastStore.getState().addToast(
        err instanceof Error ? err.message : 'Terjadi kesalahan',
        'error'
      );
    }
  };

  // Clear cart when switching stores (prevents cross-store data corruption)
  useEffect(() => {
    if (activeStore) {
      if (prevStoreIdRef.current && prevStoreIdRef.current !== activeStore.id && cart.length > 0) {
        clearCart();
        useToastStore.getState().addToast('Keranjang dikosongkan karena berganti toko.', 'info');
      }
      prevStoreIdRef.current = activeStore.id;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore]);

  // Listen for shift changes from other tabs
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === 'SHIFT_CHANGE') {
        const { shiftId, action } = msg.payload as { shiftId: string; action: string };
        if (action === 'CLOSE' && activeShiftId === shiftId) {
          useShiftStore.setState({ activeShiftId: null });
          useToastStore.getState().addToast('Shift ditutup di tab lain.', 'info');
        }
      }
    });
    return unsub;
  }, [activeShiftId]);

  useEffect(() => {
    if (user && activeStore) initialize(user.id, activeStore.id);
  }, [user, activeStore, initialize]);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const handleProductSelect = async (product: LocalProduct) => {
    let hasVariants = false;
    try {
      const vars = await db.productVariants.where('product_id').equals(product.id).toArray();
      hasVariants = vars.length > 0;
      if (hasVariants) {
        setSelectedVariantProduct(product);
        setShowVariantModal(true);
        return;
      }
    } catch (err) {
      console.warn('Gagal memuat varian, menambahkan tanpa varian:', err);
    }
    try {
      addToCart(product);
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (err) {
      useToastStore.getState().addToast(
        err instanceof Error ? err.message : 'Gagal menambahkan produk',
        'error'
      );
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const product = products.find((p) => p.sku.toLowerCase() === searchQuery.trim().toLowerCase());
    if (product) {
      handleProductSelect(product);
      setSearchQuery('');
      setBarcodeError(null);
    } else {
      setBarcodeError(`Produk dengan SKU "${searchQuery.trim()}" tidak ditemukan.`);
      setTimeout(() => setBarcodeError(null), 2000);
    }
  };

  const handleOpenShift = async () => {
    if (!user || !activeStore) return;
    await openShift(user.id, activeStore.id);
  };

  const handleVoidCart = () => {
    if (cart.length === 0) return;
    setShowVoidConfirm(true);
  };

  const confirmVoidCart = () => {
    clearCart();
    setShowVoidConfirm(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (e.key === 'F1' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); barcodeInputRef.current?.focus(); }
      if (e.key === 'F2') {
        e.preventDefault();
        if (activeStore && cart.length > 0) {
          holdCart(activeStore.id)
            .then(() => useToastStore.getState().addToast('Transaksi ditunda (Hold).', 'success'))
            .catch((err: unknown) => useToastStore.getState().addToast(err instanceof Error ? err.message : 'Gagal hold', 'error'));
        }
      }
      if (e.key === 'F3') { e.preventDefault(); setShowHeldCarts(true); }
      if (e.key === 'F4') { e.preventDefault(); loadTransactionHistory(); setShowTxHistory(true); }
      if (e.key === 'F8' && cart.length > 0) { e.preventDefault(); setShowPaymentModal(true); }
      if (e.key === 'F9') { e.preventDefault(); setShowShiftSummary(true); }
      if (e.key === 'F10') { e.preventDefault(); triggerSyncNow(); useToastStore.getState().addToast('Memulai sinkronisasi...', 'info'); }
      if (e.key === 'Backspace' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleVoidCart(); }
      if (e.key === 'Escape') { setShowPaymentModal(false); setLastTransaction(null); setShowHeldCarts(false); setShowTxHistory(false); setShowRefundModal(false); setShowVoidConfirm(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, activeStore, holdCart, triggerSyncNow, loadTransactionHistory]);

  if (shiftLoading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center text-slate">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
        Memuat status shift kasir...
      </div>
    );
  }

  if (!activeShiftId) {
    return (
      <div className="max-w-md mx-auto my-12 bg-surface p-8 rounded-xl shadow-floating border border-hairline text-center">
        <Store className="w-16 h-16 text-primary mx-auto mb-4" />
        <h2 className="font-sans font-bold text-[24px] text-ink">Buka Shift Kasir Baru</h2>
        <p className="text-charcoal font-sans text-sm mt-2 mb-6">
          Anda harus mengaktifkan shift kerja kasir baru untuk memulai transaksi di <strong>{activeStore?.name}</strong>.
        </p>
        <button onClick={handleOpenShift} className="w-full bg-primary text-on-primary font-semibold text-[15px] h-[48px] rounded-lg hover:bg-primary-pressed transition-colors flex items-center justify-center cursor-pointer shadow">
          Mulai & Buka Shift Sekarang
        </button>
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-[24px]">
      <div className="md:col-span-8 flex flex-col min-w-0 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { loadTransactionHistory(); setShowTxHistory(true); }} className="h-[48px] px-4 bg-surface border border-hairline rounded-lg text-sm font-semibold text-charcoal hover:bg-surface-muted cursor-pointer whitespace-nowrap flex-shrink-0">
            Riwayat
          </button>
          <button onClick={() => setShowHeldCarts(true)} className="h-[48px] px-4 bg-surface border border-hairline rounded-lg text-sm font-semibold text-charcoal hover:bg-surface-muted cursor-pointer whitespace-nowrap flex-shrink-0">
            Hold / Recall
          </button>
          <button onClick={() => setShowShiftSummary(true)} className="h-[48px] px-4 bg-danger-soft text-danger border border-danger/20 rounded-lg text-sm font-semibold hover:bg-danger-soft/80 cursor-pointer whitespace-nowrap flex-shrink-0">
            Tutup Shift
          </button>
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-steel" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface text-ink border border-hairline rounded-lg pl-12 pr-4 h-[48px] text-[15px] focus:outline-none focus:border-primary transition-all font-sans"
              placeholder="Cari nama produk atau ketik SKU/Barcode lalu tekan Enter..."
            />
            {barcodeError && (
              <p className="absolute top-full left-0 right-0 mt-1 text-xs text-danger bg-danger-soft px-3 py-1.5 rounded-lg font-sans">{barcodeError}</p>
            )}
          </form>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={'px-4 py-2 rounded-full font-sans font-semibold text-[13px] uppercase tracking-[0.5px] transition-colors whitespace-nowrap cursor-pointer ' + (selectedCategory === 'ALL' ? 'bg-secondary text-on-dark' : 'bg-surface text-charcoal border border-hairline hover:bg-surface-muted')}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={'px-4 py-2 rounded-full font-sans font-semibold text-[13px] uppercase tracking-[0.5px] transition-colors whitespace-nowrap cursor-pointer ' + (selectedCategory === cat.id ? 'bg-secondary text-on-dark' : 'bg-surface text-charcoal border border-hairline hover:bg-surface-muted')}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {dataLoading ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-slate">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
              Memuat data produk...
            </div>
          ) : (
            <ProductGrid products={products} selectedCategory={selectedCategory} searchQuery={debouncedSearch} onAddToCart={handleProductSelect} />
          )}
        </div>
      </div>

      <CartPanel
        cart={cart}
        subtotal={subtotal}
        discount={discount}
        discountAmount={discountAmount}
        discountType={discountType}
        tax={tax}
        total={total}
        taxEnabled={taxEnabled}
        taxRate={taxRate}
        selectedCustomer={selectedCustomer}
        discountInput={discountInput}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveFromCart={removeFromCart}
        onClearCart={handleVoidCart}
        onDiscountChange={(v) => { setDiscountInput(v); setDiscount(parseFloat(v) || 0); }}
        onDiscountTypeChange={(type) => { setDiscountInput(''); setDiscount(0); setDiscountType(type); }}
        onItemDiscountChange={setItemDiscount}
        onCustomerPickerOpen={() => setShowCustomerPicker(true)}
        onCustomerRemove={() => { setSelectedCustomer(null); setCustomerId(null); }}
        onPaymentOpen={() => setShowPaymentModal(true)}
      />

      {showPaymentModal && (
        <PaymentModal total={total} paymentSplits={paymentSplits} changeAmount={changeAmount} checkoutError={checkoutError} isSubmitting={isSubmitting}
          onClose={() => { setShowPaymentModal(false); setCheckoutError(null); }}
          onSplitChange={handlePaymentSplitChange} onSubmit={handleCheckoutSubmit}
        />
      )}

      <CustomerPickerModal show={showCustomerPicker} customers={customers} search={customerSearch}
        onClose={() => setShowCustomerPicker(false)} onSearchChange={setCustomerSearch}
        onSelect={(c) => { setSelectedCustomer(c); setCustomerId(c.id); setShowCustomerPicker(false); setCustomerSearch(''); }}
      />

      {lastTransaction && (
        <ReceiptModal lastTransaction={lastTransaction} onClose={() => setLastTransaction(null)} onPrint={handlePrintReceipt} />
      )}

      <TransactionHistoryModal show={showTxHistory} transactions={transactionHistory} txTotalCount={txTotalCount}
        onClose={() => setShowTxHistory(false)} onLoadMore={handleLoadMoreTx}
        onRefund={(tx) => { setRefundTx(tx); setRefundQtys(tx.items.map(i => i.quantity)); setShowRefundModal(true); }}
      />

      <RefundModal show={showRefundModal} transaction={refundTx} refundReason={refundReason} refunding={refunding} refundQtys={refundQtys}
        onClose={() => { setShowRefundModal(false); setRefundTx(null); setRefundReason(''); setRefundQtys([]); }}
        onReasonChange={setRefundReason} onQtyChange={(i, v) => setRefundQtys(prev => { const next = [...prev]; next[i] = v; return next; })}
        onRefund={handleRefund}
      />

      <ShiftSummaryModal show={showShiftSummary} activeShiftId={activeShiftId}
        cashierName={profile?.full_name || 'Kasir'} storeName={activeStore?.name || 'TokoKu'}
        onClose={() => setShowShiftSummary(false)}
        onConfirmCloseShift={async () => { await closeShift(); setShowShiftSummary(false); }}
      />

      {activeStore && (
        <HeldCartsModal show={showHeldCarts} storeId={activeStore.id} onClose={() => setShowHeldCarts(false)}
          onRecall={async (id) => {
            try {
              await recallCart(id);
              useToastStore.getState().addToast('Transaksi dipulihkan.', 'success');
            } catch (err: unknown) {
              useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
            }
          }}
        />
      )}

      {showVoidConfirm && (
        <div className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4" onClick={() => setShowVoidConfirm(false)} onKeyDown={(e) => { if (e.key === 'Escape') setShowVoidConfirm(false); }}>
          <div className="bg-surface rounded-xl border border-hairline max-w-sm w-full p-6 space-y-4 shadow-floating" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-danger">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-sans font-bold text-lg text-ink">Konfirmasi Void</h3>
            </div>
            <p className="text-sm text-charcoal">Hapus semua {cart.length} item dari keranjang? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowVoidConfirm(false)} className="flex-1 h-[48px] rounded-lg border border-hairline text-charcoal font-semibold text-sm hover:bg-canvas cursor-pointer">Batal</button>
              <button onClick={confirmVoidCart} className="flex-1 h-[48px] rounded-lg bg-danger text-on-primary font-semibold text-sm hover:opacity-90 cursor-pointer">Ya, Void Semua</button>
            </div>
          </div>
        </div>
      )}

      {showVariantModal && (
        <VariantSelectorModal isOpen={showVariantModal}
          onClose={() => { setShowVariantModal(false); setSelectedVariantProduct(null); }}
          product={selectedVariantProduct}
          onConfirm={(variants) => {
            if (selectedVariantProduct) {
              addToCart(selectedVariantProduct, variants);
              if (navigator.vibrate) navigator.vibrate(100);
            }
          }}
        />
      )}
    </div>
  );
}
