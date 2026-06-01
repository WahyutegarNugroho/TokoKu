import Dexie, { type Table } from 'dexie';

export interface LocalCategory {
  id: string;
  store_id: string;
  name: string;
  description?: string;
}

export interface LocalProduct {
  id: string;
  store_id: string;
  name: string;
  sku: string;
  price: number;
  category_id: string | null;
  stock: number;
  image_url: string | null;
}

export interface LocalShift {
  id: string;
  store_id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  status: 'OPEN' | 'CLOSED';
}

export interface LocalTransaction {
  id: string;
  store_id: string;
  shift_id: string;
  total_amount: number;
  tax: number;
  discount: number;
  payment_method: 'CASH' | 'DEBIT' | 'QRIS' | 'SPLIT' | 'EWALLET' | 'TRANSFER' | 'CREDIT' | 'DEBT';
  customer_id?: string | null;
  status: 'COMPLETED' | 'REFUNDED' | 'VOIDED';
  sync_status: boolean; // false = pending upload, true = synced; query via .equals(0)/.equals(1) (IndexedDB stores bools as 0/1)
  stock_deducted?: boolean; // true = Supabase RPC decrement already called (idempotency guard)
  sync_retries?: number; // retry count (gives up after 5 failed attempts)
  created_at: string;
}

export interface LocalTransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  quantity: number;
  price: number;
  discount: number;
  subtotal: number;
  variants?: string; // serialized JSON array
}

export interface LocalCustomer {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface LocalActivityLog {
  id: string;
  store_id: string;
  user_id: string;
  action: string;
  description: string;
  sync_status?: boolean;
  created_at: string;
}

export interface LocalStockHistory {
  id: string;
  store_id: string;
  product_id: string;
  user_id: string;
  old_stock: number;
  new_stock: number;
  reason: string;
  created_at: string;
}

export interface LocalPaymentSplit {
  id: string;
  transaction_id: string;
  method: 'CASH' | 'DEBIT' | 'QRIS' | 'EWALLET' | 'TRANSFER' | 'CREDIT' | 'DEBT';
  amount: number;
}

export interface LocalReturn {
  id: string;
  store_id: string;
  transaction_id: string;
  user_id: string;
  items: { product_id: string; quantity: number; refund_amount: number }[];
  reason: string;
  refund_amount: number;
  sync_status: boolean;
  created_at: string;
}

export interface LocalProductVariant {
  id: string;
  store_id: string;
  product_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface LocalVariantOption {
  id: string;
  store_id: string;
  variant_id: string;
  name: string;
  price_modifier: number;
  created_at?: string;
  updated_at?: string;
}

export interface LocalProductStorePricing {
  id: string;
  store_id: string;
  product_id: string;
  price: number;
  created_at?: string;
  updated_at?: string;
}

export interface LocalCustomerDebt {
  id: string;
  store_id: string;
  transaction_id: string;
  customer_id: string;
  amount: number;
  remaining_amount: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  due_date?: string;
  created_at: string;
  updated_at?: string;
}

export interface LocalSupplier {
  id: string;
  store_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface LocalPurchaseOrder {
  id: string;
  store_id: string;
  supplier_id: string;
  total_amount: number;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  created_at: string;
}

export interface LocalKitchenOrder {
  id: string;
  store_id: string;
  transaction_id: string;
  status: 'NEW' | 'PREPARING' | 'READY' | 'SERVED';
  notes?: string;
  created_at: string;
}

export interface LocalMembership {
  id: string;
  store_id: string;
  customer_id: string;
  points: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
}

export interface LocalPendingOp {
  id: string;
  store_id: string;
  table: 'categories' | 'products' | 'customers';
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  record_id: string;
  payload: unknown;
  created_at: string;
  retry_count: number;
  sync_status: boolean;
}

class PosDatabase extends Dexie {
  categories!: Table<LocalCategory, string>;
  products!: Table<LocalProduct, string>;
  shifts!: Table<LocalShift, string>;
  transactions!: Table<LocalTransaction, string>;
  transactionItems!: Table<LocalTransactionItem, string>;
  customers!: Table<LocalCustomer, string>;
  activityLogs!: Table<LocalActivityLog, string>;
  stockHistory!: Table<LocalStockHistory, string>;
  paymentSplits!: Table<LocalPaymentSplit, string>;
  returns!: Table<LocalReturn, string>;
  heldCarts!: Table<{
    id: string;
    store_id: string;
    items: unknown[];
    created_at: string;
    customer_id: string | null;
    tax_enabled: boolean;
    tax_rate: number;
    discount: number;
    discount_type?: 'FIXED' | 'PERCENT';
  }, string>;
  productVariants!: Table<LocalProductVariant, string>;
  variantOptions!: Table<LocalVariantOption, string>;
  productStorePricing!: Table<LocalProductStorePricing, string>;
  customerDebts!: Table<LocalCustomerDebt, string>;
  suppliers!: Table<LocalSupplier, string>;
  purchaseOrders!: Table<LocalPurchaseOrder, string>;
  kitchenOrders!: Table<LocalKitchenOrder, string>;
  memberships!: Table<LocalMembership, string>;
  pendingOps!: Table<LocalPendingOp, string>;

  constructor() {
    super('PosDatabase');
    // Version 1: Initial schema
    this.version(1).stores({
      categories: 'id, name',
      products: 'id, name, sku, category_id',
      shifts: 'id, user_id, status',
      transactions: 'id, shift_id, sync_status, created_at',
      transactionItems: 'id, transaction_id, product_id',
    });
    // Version 2: Add store_id indexes (only changed tables declared)
    this.version(2).stores({
      categories: 'id, store_id, name',
      products: 'id, store_id, name, sku, category_id',
      shifts: 'id, store_id, user_id, status',
      transactions: 'id, store_id, shift_id, created_at',
    });
    // Version 3: Add new tables (customers, activity_logs, stock_history)
    this.version(3).stores({
      customers: 'id, store_id, phone',
      activityLogs: 'id, store_id, user_id, action, created_at',
      stockHistory: 'id, store_id, product_id, created_at',
    });
    // Version 4: Add new tables (payment_splits, returns)
    this.version(4).stores({
      paymentSplits: 'id, transaction_id',
      returns: 'id, store_id, transaction_id',
    });
    // Version 5: Add sync_status index to transactions
    this.version(5).stores({
      transactions: 'id, store_id, shift_id, sync_status, created_at',
    });
    // Version 6: Add sync_status index to returns
    this.version(6).stores({
      returns: 'id, store_id, transaction_id, sync_status',
    });
    // Version 7: Add heldCarts table
    this.version(7).stores({
      heldCarts: 'id, store_id, created_at',
    });
    // Version 8: Add product variants, options, and pricing overrides
    this.version(8).stores({
      productVariants: 'id, store_id, product_id',
      variantOptions: 'id, store_id, variant_id',
      productStorePricing: 'id, store_id, product_id',
    });
    // Version 9: Add customer debts table
    this.version(9).stores({
      customerDebts: 'id, store_id, transaction_id, customer_id, status',
    });
    // Version 10: Add suppliers, purchase orders, kitchen display, memberships
    this.version(10).stores({
      suppliers: 'id, store_id, name',
      purchaseOrders: 'id, store_id, supplier_id, status',
      kitchenOrders: 'id, store_id, transaction_id, status',
      memberships: 'id, store_id, customer_id, tier',
    });
    // Version 11: Add sync_status to activityLogs
    this.version(11).stores({
      activityLogs: 'id, store_id, user_id, action, sync_status, created_at',
    });
    // Version 12: Add pendingOps table for offline admin CRUD queue
    this.version(12).stores({
      pendingOps: 'id, store_id, table, sync_status, created_at',
    });
  }
}

export const db = new PosDatabase();
export type { PosDatabase };
