'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { formatShortId } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { db, type LocalProduct, type LocalTransaction, type LocalTransactionItem, type LocalPaymentSplit, type LocalReturn } from '@/lib/dexie';
import { type CartItem, type PaymentSplit, type SelectedVariantOption } from '@/types';
import { broadcast } from '@/lib/broadcast';

/** Cart and checkout state managed by Zustand store. */
interface CartState {
  /** Current items in the cart. */
  cart: CartItem[];
  /** Subtotal before discount and tax. */
  subtotal: number;
  /** Calculated tax amount. */
  tax: number;
  /** Applied global discount value (either nominal Rp or percentage %). */
  discount: number;
  /** Calculated total discount amount in nominal (Rp). */
  discountAmount: number;
  /** Type of global discount applied (FIXED Rp or PERCENT %). */
  discountType: 'FIXED' | 'PERCENT';
  /** Final total (subtotal - discountAmount + tax). */
  total: number;
  /** Selected customer ID (optional). */
  customerId: string | null;
  /** Payment method splits for multi-payment transactions. */
  paymentSplits: PaymentSplit[];
  /** Whether tax calculation is enabled. */
  taxEnabled: boolean;
  /** Tax rate percentage (e.g., 11 for 11%). */
  taxRate: number;

  /** Add product to cart (increments quantity if already exists). Throws if stock insufficient. */
  addToCart: (product: LocalProduct, selectedVariants?: SelectedVariantOption[]) => void;
  /** Update item quantity (positive to add, negative to remove). Removes item if quantity <= 0. */
  updateQuantity: (cartItemId: string, amount: number) => void;
  /** Remove a product from cart entirely. */
  removeFromCart: (cartItemId: string) => void;
  /** Clear all items and reset cart state. */
  clearCart: () => void;
  /** Set global discount value and recalculate totals. */
  setDiscount: (d: number) => void;
  /** Toggle global discount type (FIXED or PERCENT) and recalculate totals. */
  setDiscountType: (type: 'FIXED' | 'PERCENT') => void;
  /** Apply specific item-level discount and recalculate totals. */
  setItemDiscount: (cartItemId: string, discountAmount: number) => void;
  /** Set selected customer ID for the transaction. */
  setCustomerId: (id: string | null) => void;
  /** Set payment method splits (CASH/DEBIT/QRIS amounts). */
  setPaymentSplits: (splits: PaymentSplit[]) => void;
  /** Configure tax settings (enabled/disabled and rate). */
  setTaxConfig: (enabled: boolean, rate: number) => void;
  /**
   * Complete checkout — saves transaction to IndexedDB, deducts stock, logs activity.
   * Transaction is marked as unsynced (sync_status: false) for background sync.
   * @returns Transaction ID
   */
  checkout: (storeId: string, shiftId: string) => Promise<string>;
  /**
   * Process a refund for an existing transaction (requires online connection).
   * Saves to IndexedDB, restores stock, logs activity. Marked for sync to Supabase.
   * @returns Refund ID
   */
  refundTransaction: (storeId: string, transactionId: string, items: { product_id: string; quantity: number; refund_amount: number }[], reason: string) => Promise<string>;
  /** Save current cart to IndexedDB and clear local state. */
  holdCart: (storeId: string) => Promise<void>;
  /** Restore a previously held cart state and delete it from DB. */
  recallCart: (heldCartId: string) => Promise<void>;
}

const matchVariants = (a?: SelectedVariantOption[], b?: SelectedVariantOption[]) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.option_name.localeCompare(y.option_name));
  const sortedB = [...b].sort((x, y) => x.option_name.localeCompare(y.option_name));
  return sortedA.every((val, idx) => val.option_name === sortedB[idx].option_name && val.price_modifier === sortedB[idx].price_modifier);
};

/** Calculate subtotal, tax, and total from cart items and config. */
const calculateTotals = (
  cart: CartItem[],
  discount: number,
  discountType: 'FIXED' | 'PERCENT',
  taxEnabled: boolean,
  taxRate: number
) => {
  const subtotal = cart.reduce((sum, item) => {
    const variantModifiers = item.selectedVariants?.reduce((vSum, v) => vSum + v.price_modifier, 0) || 0;
    const basePrice = item.product.price + variantModifiers;
    return sum + basePrice * item.quantity;
  }, 0);
  const itemDiscountsTotal = cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const baseSubtotal = Math.max(0, subtotal - itemDiscountsTotal);
  
  let globalDiscountAmount = 0;
  if (discountType === 'PERCENT') {
    globalDiscountAmount = Math.round(baseSubtotal * (discount / 100) * 100) / 100;
  } else {
    globalDiscountAmount = discount;
  }
  
  const discountAmount = itemDiscountsTotal + globalDiscountAmount;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = taxEnabled ? taxableAmount * (taxRate / 100) : 0;
  const total = taxableAmount + tax;
  
  return { subtotal, discountAmount, total, tax };
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
  cart: [],
  subtotal: 0,
  tax: 0,
  discount: 0,
  discountAmount: 0,
  discountType: 'FIXED',
  total: 0,
  customerId: null,
  paymentSplits: [{ method: 'CASH', amount: 0 }],
  taxEnabled: true,
  taxRate: 11,

  addToCart: (product: LocalProduct, selectedVariants?: SelectedVariantOption[]) => {
    const { cart, discount, discountType, taxEnabled, taxRate } = get();
    const existing = cart.find(
      (item) => item.product.id === product.id && matchVariants(item.selectedVariants, selectedVariants)
    );
    let newCart: CartItem[];

    if (existing) {
      const newQty = existing.quantity + 1;
      const availableStock = Math.max(0, product.stock);
      if (newQty > availableStock) {
        throw new Error(`Stok ${product.name} tidak cukup (tersedia: ${availableStock})`);
      }
      newCart = cart.map((item) =>
        item.cartItemId === existing.cartItemId
          ? { ...item, quantity: newQty }
          : item
      );
    } else {
      if (product.stock <= 0) {
        throw new Error(`Stok ${product.name} habis`);
      }
      newCart = [
        ...cart,
        {
          cartItemId: crypto.randomUUID(),
          product,
          quantity: 1,
          selectedVariants,
        },
      ];
    }

    set({ cart: newCart, ...calculateTotals(newCart, discount, discountType, taxEnabled, taxRate) });
  },

  updateQuantity: (cartItemId: string, amount: number) => {
    const { cart, discount, discountType, taxEnabled, taxRate } = get();
    const newCart = cart
      .map((item) => {
        if (item.cartItemId === cartItemId) {
          const newQty = item.quantity + amount;
          if (newQty > item.product.stock) {
            if (amount > 0) throw new Error(`Stok ${item.product.name} tidak cukup (tersedia: ${item.product.stock})`);
            return null;
          }
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    set({ cart: newCart, ...calculateTotals(newCart, discount, discountType, taxEnabled, taxRate) });
  },

  removeFromCart: (cartItemId: string) => {
    const { cart, discount, discountType, taxEnabled, taxRate } = get();
    const newCart = cart.filter((item) => item.cartItemId !== cartItemId);
    set({ cart: newCart, ...calculateTotals(newCart, discount, discountType, taxEnabled, taxRate) });
  },

  clearCart: () => {
    const { taxEnabled, taxRate } = get();
    set({ cart: [], subtotal: 0, tax: 0, discount: 0, discountAmount: 0, discountType: 'FIXED', total: 0, customerId: null, paymentSplits: [{ method: 'CASH', amount: 0 }], taxEnabled, taxRate });
  },

  setDiscount: (d: number) => {
    const { cart, discountType, taxEnabled, taxRate } = get();
    set({ discount: d, ...calculateTotals(cart, d, discountType, taxEnabled, taxRate) });
    // Re-sync payment splits to match new total
    const { total } = get();
    const { paymentSplits } = get();
    if (paymentSplits.length > 0) {
      const newSplits = paymentSplits.map((s, i) => i === 0 ? { ...s, amount: total - paymentSplits.slice(1).reduce((a, b) => a + b.amount, 0) } : s);
      set({ paymentSplits: newSplits });
    }
  },

  setDiscountType: (type: 'FIXED' | 'PERCENT') => {
    const { cart, discount, taxEnabled, taxRate } = get();
    set({ discountType: type, ...calculateTotals(cart, discount, type, taxEnabled, taxRate) });
    // Re-sync payment splits
    const { total } = get();
    const { paymentSplits } = get();
    if (paymentSplits.length > 0) {
      const newSplits = paymentSplits.map((s, i) => i === 0 ? { ...s, amount: total - paymentSplits.slice(1).reduce((a, b) => a + b.amount, 0) } : s);
      set({ paymentSplits: newSplits });
    }
  },

  setItemDiscount: (cartItemId: string, discountAmount: number) => {
    const { cart, discount, discountType, taxEnabled, taxRate } = get();
    const newCart = cart.map((item) =>
      item.cartItemId === cartItemId ? { ...item, discount: discountAmount } : item
    );
    set({ cart: newCart, ...calculateTotals(newCart, discount, discountType, taxEnabled, taxRate) });
    // Re-sync payment splits
    const { total } = get();
    const { paymentSplits } = get();
    if (paymentSplits.length > 0) {
      const newSplits = paymentSplits.map((s, i) => i === 0 ? { ...s, amount: total - paymentSplits.slice(1).reduce((a, b) => a + b.amount, 0) } : s);
      set({ paymentSplits: newSplits });
    }
  },

  setCustomerId: (id: string | null) => set({ customerId: id }),

  setPaymentSplits: (splits: PaymentSplit[]) => set({ paymentSplits: splits }),

  setTaxConfig: (enabled: boolean, rate: number) => {
    const { cart, discount, discountType } = get();
    set({ taxEnabled: enabled, taxRate: rate, ...calculateTotals(cart, discount, discountType, enabled, rate) });
  },

  checkout: async (storeId: string, shiftId: string) => {
    const { cart, total, tax, customerId, paymentSplits } = get();
    if (cart.length === 0) {
      throw new Error('Keranjang belanja kosong');
    }

    let userId: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id ?? null;
    } catch {
      // Offline — ignore session fetch failure, use fallback
    }

    if (!userId) {
      const { user } = useAuthStore.getState();
      userId = user?.id ?? null;
    }

    if (!userId) throw new Error('Sesi tidak ditemukan.');

    // Refresh stock from Supabase if online (mitigasi race condition antar device)
    if (navigator.onLine) {
      try {
        const { data: latestProducts } = await supabase
          .from('products')
          .select('id, stock')
          .eq('store_id', storeId);
        if (latestProducts) {
          for (const prod of latestProducts) {
            await db.products.update(prod.id, { stock: Number(prod.stock) });
          }
        }
      } catch {
        console.warn('Gagal refresh stok dari server, menggunakan cache lokal');
      }
    }

    // Validate payment splits
    const nonZeroSplits = paymentSplits.filter(s => s.amount > 0);
    if (nonZeroSplits.length === 0) {
      throw new Error('Pilih minimal satu metode pembayaran.');
    }
    const nonCashTotal = paymentSplits.filter(s => s.method !== 'CASH').reduce((a, b) => a + (b.amount || 0), 0);
    if (nonCashTotal > total) {
      throw new Error('Jumlah pembayaran non-tunai melebihi total tagihan.');
    }
    const splitSum = paymentSplits.reduce((sum, s) => sum + (s.amount || 0), 0);
    if (splitSum < total) {
      throw new Error('Jumlah pembayaran kurang dari total tagihan.');
    }

    // Determine payment method: 'SPLIT' if multiple methods used
    const primaryMethod = nonZeroSplits.length > 1
      ? 'SPLIT'
      : (nonZeroSplits[0]?.method || 'CASH');

    // Validate if any split uses 'DEBT' or primary method is 'DEBT'
    const hasDebt = nonZeroSplits.some(s => s.method === 'DEBT') || primaryMethod === 'DEBT';
    if (hasDebt && !customerId) {
      throw new Error('Transaksi piutang (hutang) wajib memilih pelanggan.');
    }

    const transactionId = crypto.randomUUID();
    const transaction: LocalTransaction = {
      id: transactionId,
      store_id: storeId,
      shift_id: shiftId,
      total_amount: total,
      tax: tax,
      discount: get().discountAmount,
      payment_method: primaryMethod,
      customer_id: customerId || null,
      status: 'COMPLETED',
      sync_status: false,
      created_at: new Date().toISOString(),
    };

    const splitRecords: LocalPaymentSplit[] = paymentSplits.filter(s => s.amount > 0).map(s => ({
      id: crypto.randomUUID(),
      transaction_id: transactionId,
      method: s.method,
      amount: s.amount,
    }));

    const transactionItems: LocalTransactionItem[] = cart.map((item) => {
      const variantModifiers = item.selectedVariants?.reduce((vSum, v) => vSum + v.price_modifier, 0) || 0;
      const basePrice = item.product.price + variantModifiers;
      const itemTotal = basePrice * item.quantity;
      const itemDiscount = item.discount ?? 0;
      return {
        id: crypto.randomUUID(),
        transaction_id: transactionId,
        product_id: item.product.id,
        quantity: item.quantity,
        price: basePrice,
        discount: itemDiscount,
        subtotal: itemTotal,
        variants: item.selectedVariants ? JSON.stringify(item.selectedVariants) : undefined,
      };
    });

    try {
      await db.transaction('rw', [db.transactions, db.transactionItems, db.products, db.activityLogs, db.paymentSplits, db.stockHistory, db.customerDebts], async () => {
        await db.transactions.add(transaction);

        // Save payment splits
        for (const split of splitRecords) {
          await db.paymentSplits.add(split);
        }

        // Save customer debt if any
        const debtSplit = splitRecords.find(s => s.method === 'DEBT');
        const debtAmount = debtSplit ? debtSplit.amount : (primaryMethod === 'DEBT' ? total : 0);
        if (debtAmount > 0) {
          await db.customerDebts.add({
            id: crypto.randomUUID(),
            store_id: storeId,
            transaction_id: transactionId,
            customer_id: customerId!,
            amount: debtAmount,
            remaining_amount: debtAmount,
            status: 'UNPAID',
            created_at: new Date().toISOString(),
          });
        }

        for (const item of transactionItems) {
          await db.transactionItems.add(item);
          const prod = await db.products.get(item.product_id);
          if (prod) {
            const oldStock = prod.stock;
            if (prod.stock < item.quantity) {
              throw new Error(`Stok ${prod.name} tidak cukup saat checkout`);
            }
            prod.stock = Math.max(0, prod.stock - item.quantity);
            await db.products.put(prod);
            broadcast({ type: 'STOCK_UPDATE', payload: { productId: item.product_id, newStock: prod.stock } });
            // Log stock history
            if (prod.stock !== oldStock) {
              await db.stockHistory.add({
                id: crypto.randomUUID(),
                store_id: storeId,
                product_id: item.product_id,
                user_id: userId, // filled on sync
                old_stock: oldStock,
                new_stock: prod.stock,
                reason: `Penjualan ${item.quantity}x`,
                created_at: new Date().toISOString(),
              });
            }
          }
        }

        // Log activity
        await db.activityLogs.add({
          id: crypto.randomUUID(),
          store_id: storeId,
          user_id: userId,
          action: 'CHECKOUT',
          description: `Transaksi #${formatShortId(transactionId)} - ${cart.length} item - Rp${total.toLocaleString('id-ID')}`,
          sync_status: false,
          created_at: new Date().toISOString(),
        });
      });

      get().clearCart();
      return transactionId;
    } catch (err) {
      console.error('Checkout IndexedDB error:', err);
      throw new Error('Gagal memproses transaksi secara lokal');
    }
  },

  refundTransaction: async (storeId: string, transactionId: string, items: { product_id: string; quantity: number; refund_amount: number }[], reason: string) => {
    if (!navigator.onLine) throw new Error('Refund membutuhkan koneksi online.');
    const { data: { session } } = await supabase.auth.getSession();
    const refundUserId = session?.user?.id;
    if (!refundUserId) throw new Error('Sesi tidak ditemukan.');
    try {
      const refund: LocalReturn = {
        id: crypto.randomUUID(),
        store_id: storeId,
        transaction_id: transactionId,
        user_id: refundUserId,
        items,
        reason,
        refund_amount: items.reduce((s, i) => s + i.refund_amount, 0),
        sync_status: false,
        created_at: new Date().toISOString(),
      };
      await db.transaction('rw', [db.returns, db.transactions, db.products, db.stockHistory, db.activityLogs], async () => {
        await db.returns.add(refund);
        await db.transactions.update(transactionId, { status: 'REFUNDED', sync_status: false });
        for (const item of items) {
          const prod = await db.products.get(item.product_id);
          if (prod) {
            const oldStock = prod.stock;
            prod.stock += item.quantity;
            await db.products.put(prod);
            await db.stockHistory.add({
              id: crypto.randomUUID(), store_id: storeId, product_id: item.product_id,
              user_id: refundUserId, old_stock: oldStock, new_stock: prod.stock,
              reason: `Refund: ${reason}`, created_at: new Date().toISOString(),
            });
          }
        }
        await db.activityLogs.add({
          id: crypto.randomUUID(), store_id: storeId, user_id: refundUserId,
          action: 'REFUND', description: `Refund transaksi #${formatShortId(transactionId)} - Rp${refund.refund_amount.toLocaleString('id-ID')}`,
          sync_status: false,
          created_at: new Date().toISOString(),
        });
      });
      return refund.id;
    } catch (err) { console.error('Refund error:', err); throw new Error('Gagal memproses refund.'); }
  },

  holdCart: async (storeId) => {
    const { cart, discount, discountType, customerId, taxEnabled, taxRate, clearCart } = get();
    if (cart.length === 0) throw new Error('Keranjang belanja kosong.');
    
    const count = await db.heldCarts.where('store_id').equals(storeId).count();
    if (count >= 5) {
      throw new Error('Maksimal penundaan adalah 5 transaksi. Silakan proses transaksi tertunda terlebih dahulu.');
    }

    try {
      await db.heldCarts.add({
        id: crypto.randomUUID(),
        store_id: storeId,
        items: cart,
        discount,
        discount_type: discountType,
        customer_id: customerId,
        tax_enabled: taxEnabled,
        tax_rate: taxRate,
        created_at: new Date().toISOString(),
      });
      clearCart();
    } catch (err) {
      console.error('Error holding cart:', err);
      throw new Error('Gagal menunda transaksi.');
    }
  },

  recallCart: async (heldCartId) => {
    try {
      const held = await db.heldCarts.get(heldCartId);
      if (!held) throw new Error('Transaksi tertunda tidak ditemukan.');

      const type = held.discount_type || 'FIXED';
      set({
        cart: held.items as CartItem[],
        discount: held.discount,
        discountType: type,
        customerId: held.customer_id,
        taxEnabled: held.tax_enabled,
        taxRate: held.tax_rate,
        ...calculateTotals(held.items as CartItem[], held.discount, type, held.tax_enabled, held.tax_rate),
      });

      await db.heldCarts.delete(heldCartId);
    } catch (err) {
      console.error('Error recalling cart:', err);
      throw new Error(err instanceof Error ? err.message : 'Gagal memulihkan transaksi.');
    }
  },
    }),
    {
      name: 'tokoku-cart',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        cart: state.cart,
        discount: state.discount,
        discountType: state.discountType,
        paymentSplits: state.paymentSplits,
        customerId: state.customerId,
        taxEnabled: state.taxEnabled,
        taxRate: state.taxRate,
      }),
    }
  )
);
