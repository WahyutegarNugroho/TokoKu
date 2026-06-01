import { supabase } from './supabase';
import { db } from './dexie';

async function queueOp(
  storeId: string, table: string, operation: string, recordId: string, payload: unknown
) {
  try {
    await db.pendingOps.add({
      id: crypto.randomUUID(),
      store_id: storeId,
      table: table as 'categories' | 'products' | 'customers',
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
    return { data: product as never, error: null };
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
