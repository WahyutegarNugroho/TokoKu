import { supabase } from './supabase';
import { db } from './dexie';
import type { LocalPromotion } from './dexie';

async function queueOp(
  storeId: string, table: string, operation: string, recordId: string, payload: unknown
) {
  try {
    await db.pendingOps.add({
      id: crypto.randomUUID(),
      store_id: storeId,
      table: table as 'categories' | 'products' | 'customers' | 'debt_payments' | 'suppliers' | 'purchase_orders' | 'product_batches' | 'warehouses' | 'warehouse_stocks' | 'user_permissions',
      operation: operation as 'CREATE' | 'UPDATE' | 'DELETE',
      record_id: recordId,
      payload,
      created_at: new Date().toISOString(),
      retry_count: 0,
      sync_status: false,
    });
  } catch (err) {
    console.warn('Failed to queue pending op:', err);
  }
}

/** Custom error class for PostgREST API errors with machine-readable error codes. */
export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/**
 * Translates PostgREST error codes into user-friendly messages.
 * Throws ApiError for known constraint violations, generic message for unknown errors.
 * @param error - Raw error from Supabase/PostgREST
 * @param context - Operation context for error message
 * @throws ApiError for known errors, original error otherwise
 */
export function handlePostgrest(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const pgError = error as { code: string; message: string; details?: string };
    const userMessages: Record<string, string> = {
      '23502': 'Data wajib tidak boleh kosong.',
      '23503': 'Data ini masih digunakan oleh data lain.',
      '23505': 'Data dengan nilai yang sama sudah ada.',
      '42501': 'Anda tidak memiliki akses untuk operasi ini.',
      'PGRST301': 'Data yang diminta tidak ditemukan.',
    };
    const userMsg = userMessages[pgError.code];
    if (userMsg) throw new ApiError(pgError.code, userMsg);
    throw new ApiError(pgError.code, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
  throw error;
}

function checkError<T extends { error: unknown }>(result: T): T {
  if (result.error) handlePostgrest(result.error);
  return result;
}

/** CRUD operations for product categories, scoped to store_id. */
export const categoriesApi = {
  /** List all categories for a store, ordered by name. */
  list: (storeId: string) =>
    supabase.from('categories').select('*').eq('store_id', storeId).order('name'),

  /** Create a new category. Trims name and description. */
  create: async (storeId: string, name: string, description?: string) => {
    const trimmedName = name.trim();
    if (trimmedName.length > 100) throw new ApiError('VALIDATION', 'Nama kategori maksimal 100 karakter.');
    if (description && description.trim().length > 500) throw new ApiError('VALIDATION', 'Deskripsi maksimal 500 karakter.');
    const id = crypto.randomUUID();
    const desc = description?.trim() || null;
    try {
      await db.categories.put({ id, store_id: storeId, name: trimmedName, description: (desc ?? undefined) });
    } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('categories').insert({ id, store_id: storeId, name: trimmedName, description: desc });
      if (result.error) {
        await queueOp(storeId, 'categories', 'CREATE', id, { name: trimmedName, description: desc });
      }
      return { data: result.data || { id, name: trimmedName, description: desc }, error: null };
    }
    await queueOp(storeId, 'categories', 'CREATE', id, { name: trimmedName, description: desc });
    return { data: { id, name: trimmedName, description: desc } as never, error: null };
  },

  /** Update an existing category by ID. */
  update: async (storeId: string, id: string, name: string, description?: string) => {
    const trimmedName = name.trim();
    const trimmedDesc: string | null = description?.trim() || null;
    try {
      await db.categories.update(id, { name: trimmedName, description: trimmedDesc ?? undefined });
    } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('categories').update({ name: trimmedName, description: trimmedDesc }).eq('id', id).eq('store_id', storeId);
      if (result.error) {
        await queueOp(storeId, 'categories', 'UPDATE', id, { name: trimmedName, description: trimmedDesc });
      }
      return { data: result.data, error: null };
    }
    await queueOp(storeId, 'categories', 'UPDATE', id, { name: trimmedName, description: trimmedDesc });
    return { data: null, error: null };
  },

  /** Delete a category by ID. Fails if products reference it (FK constraint). */
  remove: async (storeId: string, id: string) => {
    try {
      await db.categories.delete(id);
    } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('categories').delete().eq('id', id).eq('store_id', storeId);
      if (result.error) {
        await queueOp(storeId, 'categories', 'DELETE', id, {});
      }
      return { data: result.data, error: null };
    }
    await queueOp(storeId, 'categories', 'DELETE', id, {});
    return { data: null, error: null };
  },
};

/** CRUD operations for promotions (scheduled discounts), scoped to store_id. */
export const promotionsApi = {
  /** List all active and inactive promotions for a store. */
  list: (storeId: string) =>
    supabase
      .from('promotions')
      .select('*')
      .eq('store_id', storeId)
      .order('start_date', { ascending: false }),

  /** Get active promotions for a store (enabled and date range valid). */
  getActive: (storeId: string) => {
    const now = new Date().toISOString();
    return supabase
      .from('promotions')
      .select('*')
      .eq('store_id', storeId)
      .eq('enabled', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('start_date', { ascending: false });
  },

  /** Create a new promotion. */
  create: async (storeId: string, promo: {
    name: string; description?: string; type: 'PERCENT' | 'FIXED'; value: number;
    start_date: string; end_date: string; enabled?: boolean;
  }) => {
    if (promo.name.trim().length === 0) throw new ApiError('VALIDATION', 'Nama promo wajib diisi.');
    if (promo.value < 0) throw new ApiError('VALIDATION', 'Nilai promo tidak boleh negatif.');
    if (new Date(promo.start_date) >= new Date(promo.end_date)) throw new ApiError('VALIDATION', 'Tanggal mulai harus sebelum tanggal berakhir.');
    
    const id = crypto.randomUUID();
    const promotion = {
      id,
      store_id: storeId,
      name: promo.name.trim(),
      description: promo.description?.trim() || undefined,
      type: promo.type,
      value: promo.value,
      start_date: promo.start_date,
      end_date: promo.end_date,
      enabled: promo.enabled ?? true,
    };

    try {
      await db.promotions.put(promotion);
    } catch {}

    if (navigator.onLine) {
      const result = await supabase.from('promotions').insert(promotion);
      if (result.error) {
        await queueOp(storeId, 'promotions' as never, 'CREATE', id, promo);
      }
      return { data: result.data || [promotion], error: null };
    }

    await queueOp(storeId, 'promotions' as never, 'CREATE', id, promo);
    return { data: [promotion], error: null };
  },

  /** Update an existing promotion. */
  update: async (storeId: string, id: string, promo: {
    name?: string; description?: string; type?: 'PERCENT' | 'FIXED'; value?: number;
    start_date?: string; end_date?: string; enabled?: boolean;
  }) => {
    const updates: Partial<LocalPromotion> = {};
    if (promo.name !== undefined) updates.name = promo.name.trim();
    if (promo.description !== undefined) updates.description = promo.description?.trim() || undefined;
    if (promo.type !== undefined) updates.type = promo.type;
    if (promo.value !== undefined) updates.value = promo.value;
    if (promo.start_date !== undefined) updates.start_date = promo.start_date;
    if (promo.end_date !== undefined) updates.end_date = promo.end_date;
    if (promo.enabled !== undefined) updates.enabled = promo.enabled;

    try {
      await db.promotions.update(id, updates);
    } catch {}

    if (navigator.onLine) {
      const result = await supabase
        .from('promotions')
        .update(updates as never)
        .eq('id', id)
        .eq('store_id', storeId);
      if (result.error) {
        await queueOp(storeId, 'promotions' as never, 'UPDATE', id, promo);
      }
      return { data: result.data, error: null };
    }

    await queueOp(storeId, 'promotions' as never, 'UPDATE', id, promo);
    return { data: null, error: null };
  },

  /** Delete a promotion by ID. */
  delete: async (storeId: string, id: string) => {
    try {
      await db.promotions.delete(id);
    } catch {}

    if (navigator.onLine) {
      const result = await supabase
        .from('promotions')
        .delete()
        .eq('id', id)
        .eq('store_id', storeId);
      if (result.error) {
        await queueOp(storeId, 'promotions' as never, 'DELETE', id, {});
      }
      return { data: null, error: null };
    }

    await queueOp(storeId, 'promotions' as never, 'DELETE', id, {});
    return { data: null, error: null };
  },
};

/** CRUD operations for products, scoped to store_id. */
export const productsApi = {
  /** List all products for a store, ordered by name. */
  list: (storeId: string) =>
    supabase.from('products').select('*').eq('store_id', storeId).order('name'),

  /** Create a new product with store_id auto-assigned. */
  create: async (storeId: string, payload: {
    name: string; sku: string; price: number; category_id?: string | null;
    stock?: number; image_url?: string | null;
  }) => {
    if (payload.name.trim().length > 200) throw new ApiError('VALIDATION', 'Nama produk maksimal 200 karakter.');
    if (payload.sku.trim().length > 50) throw new ApiError('VALIDATION', 'SKU maksimal 50 karakter.');
    const id = crypto.randomUUID();
    const product = { id, store_id: storeId, name: payload.name.trim(), sku: payload.sku.trim(), price: payload.price, category_id: payload.category_id ?? null, stock: payload.stock ?? 0, image_url: payload.image_url ?? null };
    try {
      await db.products.put(product);
    } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('products').insert(product);
      if (result.error) {
        await queueOp(storeId, 'products', 'CREATE', id, payload);
      }
      return { data: result.data || product, error: null };
    }
    await queueOp(storeId, 'products', 'CREATE', id, payload);
    return { data: product, error: null };
  },

  /** Update product fields by ID. Partial update — only provided fields change. */
  update: async (storeId: string, id: string, payload: Partial<{
    name: string; sku: string; price: number; category_id: string | null;
    stock: number; image_url: string | null;
  }>) => {
    try {
      await db.products.update(id, payload);
    } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('products').update(payload).eq('id', id).eq('store_id', storeId);
      if (result.error) {
        await queueOp(storeId, 'products', 'UPDATE', id, payload);
      }
      return { data: result.data, error: null };
    }
    await queueOp(storeId, 'products', 'UPDATE', id, payload);
    return { data: null, error: null };
  },

  /** Delete a product by ID. Fails if transaction_items reference it. */
  remove: async (storeId: string, id: string) => {
    try {
      await db.products.delete(id);
    } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('products').delete().eq('id', id).eq('store_id', storeId);
      if (result.error) {
        await queueOp(storeId, 'products', 'DELETE', id, {});
      }
      return { data: result.data, error: null };
    }
    await queueOp(storeId, 'products', 'DELETE', id, {});
    return { data: null, error: null };
  },
};

/** CRUD operations for customers, scoped to store_id. */
export const customersApi = {
  /** List all customers for a store, ordered by name. */
  list: (storeId: string) =>
    supabase.from('customers').select('*').eq('store_id', storeId).order('name'),

  /** Create a new customer. Validates name length, phone, email format. */
  create: async (storeId: string, payload: { name: string; phone?: string; email?: string; credit_limit?: number }) => {
    const trimmedName = payload.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 200) throw new ApiError('VALIDATION', 'Nama pelanggan 2-200 karakter.');
    const trimmedPhone = payload.phone?.trim() || '';
    const trimmedEmail = payload.email?.trim().toLowerCase() || '';
    const creditLimit = payload.credit_limit || 0;
    const id = crypto.randomUUID();
    const customer = { id, store_id: storeId, name: trimmedName, phone: trimmedPhone, email: trimmedEmail, credit_limit: creditLimit, created_at: new Date().toISOString() };
    try {
      await db.customers.put(customer);
    } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('customers').insert(customer);
      if (result.error) {
        await queueOp(storeId, 'customers', 'CREATE', id, { name: trimmedName, phone: trimmedPhone, email: trimmedEmail, credit_limit: creditLimit });
      }
      return { data: result.data || customer, error: null };
    }
    await queueOp(storeId, 'customers', 'CREATE', id, { name: trimmedName, phone: trimmedPhone, email: trimmedEmail, credit_limit: creditLimit });
    return { data: customer, error: null };
  },

  /** Delete a customer by ID. */
  remove: async (storeId: string, id: string) => {
    try {
      await db.customers.delete(id);
    } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('customers').delete().eq('id', id).eq('store_id', storeId);
      if (result.error) {
        await queueOp(storeId, 'customers', 'DELETE', id, {});
      }
      return { data: result.data, error: null };
    }
    await queueOp(storeId, 'customers', 'DELETE', id, {});
    return { data: null, error: null };
  },
};

/** Operations for store member management (roles, invites). */
export const membersApi = {
  /** List all members of a store with user profile data. */
  list: (storeId: string) =>
    supabase
      .from('store_members')
      .select('id, user_id, role, users:user_id (email, full_name)')
      .eq('store_id', storeId),

  /** Update a member's role (OWNER/ADMIN/KASIR). */
  updateRole: async (storeId: string, memberId: string, role: string) => {
    const result = await supabase.from('store_members').update({ role }).eq('id', memberId).eq('store_id', storeId);
    return checkError(result);
  },

  /** Remove a member from a store. */
  remove: async (storeId: string, memberId: string) => {
    const result = await supabase.from('store_members').delete().eq('id', memberId).eq('store_id', storeId);
    return checkError(result);
  },

  /** Add a user to a store by email via RPC (creates membership directly). */
  addDirect: (storeId: string, email: string, role: string) =>
    supabase.rpc('add_member_direct', { p_store_id: storeId, p_user_email: email, p_role: role }),
};

/** Operations for store management (create, update, delete). */
export const storesApi = {
  /** Create a new store via RPC — generates UUID server-side + audit log. */
  create: async (name: string, address?: string | null, phone?: string | null) => {
    if (name.trim().length > 200) throw new ApiError('VALIDATION', 'Nama toko maksimal 200 karakter.');
    if (address && address.trim().length > 500) throw new ApiError('VALIDATION', 'Alamat maksimal 500 karakter.');
    return supabase.rpc('create_store_with_membership', {
      p_store_name: name,
      p_store_address: address || null,
      p_store_phone: phone || null,
    });
  },

  /** Update store settings (name, address, tax config). */
  update: async (id: string, payload: { name?: string; address?: string | null; phone?: string | null; tax_enabled?: boolean; tax_rate?: number }) => {
    const result = await supabase.from('stores').update(payload).eq('id', id);
    return checkError(result);
  },

  /** Delete a store and all its data via RPC (cascading delete). */
  delete: async (storeId: string) => {
    const result = await supabase.rpc('delete_store', { p_store_id: storeId });
    return checkError(result);
  },
};

/** Operations for store invite management (create, list, revoke). */
export const invitesApi = {
  /** Create a new invite code for a store. */
  create: async (storeId: string, code: string, role: string, createdBy: string, maxUses?: number, expiresAt?: string) => {
    const result = await supabase.from('store_invites').insert({
      store_id: storeId, code, role, max_uses: maxUses || 10, created_by: createdBy,
      expires_at: expiresAt || null,
    });
    return checkError(result);
  },

  /** List all active invites for a store via RPC. */
  list: (storeId: string) =>
    supabase.rpc('list_store_invites', { p_store_id: storeId }),

  /** Revoke an invite code, preventing further use. */
  revoke: (inviteId: string) =>
    supabase.rpc('revoke_invite', { p_invite_id: inviteId }),
};

/** Operations for activity logging. */
export const activityApi = {
  /** Log a user action (CHECKOUT, REFUND, etc.) for audit trail. */
  log: async (storeId: string, userId: string, action: string, description: string) => {
    const result = await supabase.from('activity_logs').insert({
      store_id: storeId, user_id: userId, action, description,
    });
    return checkError(result);
  },
};

/** Operations for stock change history logging. */
export const stockHistoryApi = {
  /** Log a stock change event (sale, refund, manual adjustment). */
  log: async (storeId: string, userId: string, productId: string, oldStock: number, newStock: number, reason: string) => {
    const result = await supabase.from('stock_history').insert({
      store_id: storeId, product_id: productId, user_id: userId,
      old_stock: oldStock, new_stock: newStock, reason,
    });
    return checkError(result);
  },
};

/** CRUD operations for suppliers, scoped to store_id. */
export const suppliersApi = {
  /** List all suppliers for a store, ordered by name. */
  list: (storeId: string) =>
    supabase.from('suppliers').select('*').eq('store_id', storeId).order('name'),

  /** Create a new supplier. */
  create: async (storeId: string, payload: { name: string; phone?: string; email?: string; address?: string }) => {
    const trimmedName = payload.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 200) throw new ApiError('VALIDATION', 'Nama supplier 2-200 karakter.');
    const id = crypto.randomUUID();
    const supplier = { id, store_id: storeId, name: trimmedName, phone: payload.phone?.trim() || '', email: payload.email?.trim().toLowerCase() || '', address: payload.address?.trim() || '' };
    try { await db.suppliers.put(supplier); } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('suppliers').insert(supplier);
      if (result.error) { await queueOp(storeId, 'suppliers', 'CREATE', id, { name: trimmedName, phone: supplier.phone, email: supplier.email, address: supplier.address }); }
      return { data: result.data || supplier, error: null };
    }
    await queueOp(storeId, 'suppliers', 'CREATE', id, { name: trimmedName, phone: supplier.phone, email: supplier.email, address: supplier.address });
    return { data: supplier, error: null };
  },

  /** Update a supplier. */
  update: async (storeId: string, id: string, payload: { name?: string; phone?: string; email?: string; address?: string }) => {
    const updates: Record<string, string> = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.phone !== undefined) updates.phone = payload.phone.trim();
    if (payload.email !== undefined) updates.email = payload.email.trim().toLowerCase();
    if (payload.address !== undefined) updates.address = payload.address.trim();
    try { await db.suppliers.update(id, updates); } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('suppliers').update(updates).eq('id', id).eq('store_id', storeId);
      if (result.error) { await queueOp(storeId, 'suppliers', 'UPDATE', id, updates); }
      return { data: result.data, error: null };
    }
    await queueOp(storeId, 'suppliers', 'UPDATE', id, updates);
    return { data: null, error: null };
  },

  /** Delete a supplier. */
  remove: async (storeId: string, id: string) => {
    try { await db.suppliers.delete(id); } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('suppliers').delete().eq('id', id).eq('store_id', storeId);
      if (result.error) { await queueOp(storeId, 'suppliers', 'DELETE', id, {}); }
      return { data: result.data, error: null };
    }
    await queueOp(storeId, 'suppliers', 'DELETE', id, {});
    return { data: null, error: null };
  },
};

/** CRUD operations for purchase orders, scoped to store_id. */
export const purchaseOrdersApi = {
  /** List all purchase orders for a store with supplier name and item count. */
  list: (storeId: string) =>
    supabase
      .from('purchase_orders')
      .select('*, suppliers(name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false }),

  /** Get a single purchase order with items. */
  getById: (storeId: string, poId: string) =>
    supabase
      .from('purchase_orders')
      .select('*, suppliers(name), purchase_order_items(*)')
      .eq('id', poId)
      .eq('store_id', storeId)
      .maybeSingle(),

  /** Create a new purchase order (PENDING). */
  create: async (storeId: string, payload: { supplier_id: string; items: { product_id: string; quantity: number; unit_price: number }[] }) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const po = { id, store_id: storeId, supplier_id: payload.supplier_id, total_amount: 0, status: 'PENDING' as const, created_at: now };
    try { await db.purchaseOrders.put(po); } catch {}
    if (navigator.onLine) {
      const { error } = await supabase.from('purchase_orders').insert({ id, store_id: storeId, supplier_id: payload.supplier_id, total_amount: 0, status: 'PENDING' });
      if (error) { await queueOp(storeId, 'purchase_orders', 'CREATE', id, { supplier_id: payload.supplier_id, items: payload.items }); }
      return { data: { ...po, items: payload.items }, error: null };
    }
    await queueOp(storeId, 'purchase_orders', 'CREATE', id, { supplier_id: payload.supplier_id, items: payload.items });
    return { data: { ...po, items: payload.items }, error: null };
  },

  /** Receive a purchase order — atomically inserts items and increments stock. */
  receive: async (storeId: string, poId: string, items: { product_id: string; quantity: number; unit_price: number }[]) => {
    const { error } = await supabase.rpc('receive_purchase_order', {
      p_po_id: poId,
      p_store_id: storeId,
      p_items: JSON.stringify(items),
    });
    return { data: null, error };
  },

  /** Cancel a purchase order. */
  cancel: async (storeId: string, poId: string, items: { product_id: string; quantity: number; unit_price: number }[]) => {
    try {
      await db.purchaseOrders.update(poId, { status: 'CANCELLED' });
    } catch {}
    if (navigator.onLine) {
      const { error } = await supabase.from('purchase_orders').update({ status: 'CANCELLED' }).eq('id', poId).eq('store_id', storeId);
      if (error) { await queueOp(storeId, 'purchase_orders', 'UPDATE', poId, { status: 'CANCELLED', items }); }
      return { data: null, error: null };
    }
    await queueOp(storeId, 'purchase_orders', 'UPDATE', poId, { status: 'CANCELLED', items });
    return { data: null, error: null };
  },
};

/** Operations for debt (piutang) and debt payments. */
export const debtsApi = {
  /** List all customer debts for a store with customer info, ordered by created_at descending. */
  list: (storeId: string) =>
    supabase
      .from('customer_debts')
      .select('*, customers(name, phone)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false }),

  /** Get a single debt with payment history. */
  getById: (debtId: string) =>
    supabase
      .from('customer_debts')
      .select('*, customers(name, phone), debt_payments(*)')
      .eq('id', debtId)
      .maybeSingle(),

  /** List debt payments for a specific debt. */
  listPayments: (debtId: string) =>
    supabase
      .from('debt_payments')
      .select('*')
      .eq('debt_id', debtId)
      .order('paid_at', { ascending: false }),

  /** Record a debt payment (offline-first: writes to Dexie, queues via pendingOps). */
  createPayment: async (storeId: string, debtId: string, payload: { amount: number; payment_method: string; notes?: string }) => {
    const id = crypto.randomUUID();
    const payment = {
      id,
      store_id: storeId,
      debt_id: debtId,
      amount: payload.amount,
      payment_method: payload.payment_method as 'CASH' | 'TRANSFER' | 'CARD' | 'OTHER',
      notes: payload.notes || '',
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      sync_status: false,
    };
    // Persist locally first
    try {
      await db.debtPayments.put(payment);
    } catch {}
    // Try Supabase, fallback to pendingOps
    if (navigator.onLine) {
      const result = await supabase.from('debt_payments').insert({
        id,
        store_id: storeId,
        debt_id: debtId,
        amount: payload.amount,
        payment_method: payload.payment_method,
        notes: payload.notes || null,
      });
      if (!result.error) {
        // Update the debt's remaining_amount via RPC
        await supabase.rpc('apply_debt_payment', { p_debt_id: debtId, p_amount: payload.amount });
        return checkError(result);
      }
      await queueOp(storeId, 'debt_payments', 'CREATE', id, { debt_id: debtId, ...payload });
      return { data: null, error: null };
    }
    await queueOp(storeId, 'debt_payments', 'CREATE', id, { debt_id: debtId, ...payload });
    return { data: null, error: null };
  },
};

/** Operations for memberships (loyalty points). */
export const membershipsApi = {
  /** Get membership for a customer in a store. */
  getByCustomer: (storeId: string, customerId: string) =>
    supabase
      .from('memberships')
      .select('*')
      .eq('store_id', storeId)
      .eq('customer_id', customerId)
      .maybeSingle(),

  /** Award points to a customer (via RPC). */
  awardPoints: async (storeId: string, customerId: string, points: number) => {
    const { data, error } = await supabase.rpc('award_points', {
      p_store_id: storeId,
      p_customer_id: customerId,
      p_points: points,
    });
    return { data, error };
  },

  /** Redeem points for a discount (via RPC). */
  redeemPoints: async (storeId: string, customerId: string, points: number) => {
    const { data, error } = await supabase.rpc('redeem_points', {
      p_store_id: storeId,
      p_customer_id: customerId,
      p_points: points,
    });
    return { data, error };
  },
};

/** Operations for transaction management (list, get, refund, status update). */
export const transactionsApi = {
  /** List transactions for a store with pagination. Includes items and customer name. */
  list: (storeId: string, limit = 50, offset = 0) =>
    supabase
      .from('transactions')
      .select('*, transaction_items(*), customers(name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),

  /** Get a single transaction with all related data (items, splits, returns). */
  getById: (storeId: string, transactionId: string) =>
    supabase
      .from('transactions')
      .select('*, transaction_items(*), payment_splits(*), returns(*)')
      .eq('id', transactionId)
      .eq('store_id', storeId)
      .maybeSingle(),

  /** Create a refund record for a transaction. */
  refund: async (transactionId: string, items: { product_id: string; quantity: number; refund_amount: number }[], reason: string, storeId: string, userId: string) => {
    const refundAmount = items.reduce((sum, i) => sum + i.refund_amount, 0);
    const result = await supabase.from('returns').insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      transaction_id: transactionId,
      user_id: userId,
      items,
      reason,
      refund_amount: refundAmount,
    });
    return checkError(result);
  },

  /** Update transaction status (COMPLETED/REFUNDED/VOIDED). */
  updateStatus: async (storeId: string, transactionId: string, status: 'COMPLETED' | 'REFUNDED' | 'VOIDED') => {
    const result = await supabase
      .from('transactions')
      .update({ status })
      .eq('id', transactionId)
      .eq('store_id', storeId);
    return checkError(result);
  },
};

/** Operations for returns (transaction refunds + non-transaction returns like supplier returns). */
export const returnsApi = {
  /** List returns for a store with pagination. */
  list: (storeId: string, limit = 50, offset = 0) =>
    supabase
      .from('returns')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),

  /** Get a single return record. */
  getById: (storeId: string, returnId: string) =>
    supabase
      .from('returns')
      .select('*')
      .eq('id', returnId)
      .eq('store_id', storeId)
      .maybeSingle(),

  /** Create a return record (with or without transaction_id). Supports supplier returns & refunds. */
  create: async (storeId: string, dto: {
    transaction_id?: string | null;
    items: { product_id: string; quantity: number; refund_amount: number }[];
    reason: string;
  }, userId: string) => {
    const refundAmount = dto.items.reduce((sum, i) => sum + i.refund_amount, 0);
    const result = await supabase.from('returns').insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      transaction_id: dto.transaction_id || null,
      user_id: userId,
      items: dto.items,
      reason: dto.reason,
      refund_amount: refundAmount,
    });
    return checkError(result);
  },

  /** Delete a return record (admin only). */
  delete: async (storeId: string, returnId: string) => {
    const result = await supabase
      .from('returns')
      .delete()
      .eq('id', returnId)
      .eq('store_id', storeId);
    return checkError(result);
  },
};

/** Operations for product batches and expiry dates. */
export const productBatchesApi = {
  list: (storeId: string) =>
    supabase.from('product_batches').select('*').eq('store_id', storeId).order('expiry_date', { ascending: true }),

  create: async (storeId: string, payload: { product_id: string; batch_no: string; expiry_date: string; quantity: number }) => {
    const id = crypto.randomUUID();
    const item = { id, store_id: storeId, ...payload, created_at: new Date().toISOString() };
    try { await db.productBatches.put(item); } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('product_batches').insert(item);
      if (result.error) { await queueOp(storeId, 'product_batches' as never, 'CREATE', id, payload); }
      return { data: item, error: null };
    }
    await queueOp(storeId, 'product_batches' as never, 'CREATE', id, payload);
    return { data: item, error: null };
  },

  delete: async (storeId: string, id: string) => {
    try { await db.productBatches.delete(id); } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('product_batches').delete().eq('id', id).eq('store_id', storeId);
      if (result.error) { await queueOp(storeId, 'product_batches' as never, 'DELETE', id, {}); }
      return { data: null, error: null };
    }
    await queueOp(storeId, 'product_batches' as never, 'DELETE', id, {});
    return { data: null, error: null };
  },
};

/** Operations for multi-warehouse and stock locations. */
export const warehousesApi = {
  list: (storeId: string) =>
    supabase.from('warehouses').select('*').eq('store_id', storeId).order('name'),

  create: async (storeId: string, payload: { name: string; address?: string }) => {
    const id = crypto.randomUUID();
    const item = { id, store_id: storeId, name: payload.name, address: payload.address || '', created_at: new Date().toISOString() };
    try { await db.warehouses.put(item); } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('warehouses').insert(item);
      if (result.error) { await queueOp(storeId, 'warehouses' as never, 'CREATE', id, payload); }
      return { data: item, error: null };
    }
    await queueOp(storeId, 'warehouses' as never, 'CREATE', id, payload);
    return { data: item, error: null };
  },

  listStocks: (storeId: string) =>
    supabase.from('warehouse_stocks').select('*').eq('store_id', storeId),

  updateStock: async (storeId: string, warehouseId: string, productId: string, stock: number) => {
    const id = crypto.randomUUID();
    const item = { id, store_id: storeId, warehouse_id: warehouseId, product_id: productId, stock };
    try { await db.warehouseStocks.put(item); } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('warehouse_stocks').upsert(item);
      return checkError(result);
    }
    return { data: item, error: null };
  },
};

/** Operations for granular permissions. */
export const userPermissionsApi = {
  list: (storeId: string) =>
    supabase.from('user_permissions').select('*').eq('store_id', storeId),

  update: async (storeId: string, userId: string, permissionKey: string, enabled: boolean) => {
    const id = crypto.randomUUID();
    const item = { id, store_id: storeId, user_id: userId, permission_key: permissionKey, enabled };
    try { await db.userPermissions.put(item); } catch {}
    if (navigator.onLine) {
      const result = await supabase.from('user_permissions').upsert(item);
      return checkError(result);
    }
    return { data: item, error: null };
  },
};

