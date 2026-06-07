import { db } from './dexie';
import { supabase } from './supabase';

async function syncGuard() {
  if (!navigator.onLine) return { offline: true, auth: false };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { offline: false, auth: false };
  return { offline: false, auth: true };
}

/**
 * Sync all local shifts to Supabase.
 * Handles orphaned shifts (deleted users) by auto-removing them.
 * @param storeId - Optional filter to sync only shifts for a specific store
 * @returns Success status and error message if failed
 */
export async function syncShifts(storeId?: string) {
  const guard = await syncGuard();
  if (!guard.auth) return { success: false, syncedCount: 0, error: guard.offline ? 'Offline' : 'Unauthenticated' };

  try {

    let localShifts = await db.shifts.toArray();
    if (storeId) {
      localShifts = localShifts.filter(s => s.store_id === storeId);
    }

    let syncedCount = 0;
    for (const shift of localShifts) {
      const { error } = await supabase
        .from('shifts')
        .upsert({
          id: shift.id,
          store_id: shift.store_id,
          user_id: shift.user_id,
          start_time: shift.start_time,
          end_time: shift.end_time || null,
          beginning_cash: shift.beginning_cash || 0,
          status: shift.status
        }, { onConflict: 'id' });

      if (error) {
        console.error(`Failed to sync shift ${shift.id}:`, error.message || JSON.stringify(error));
        
        // Auto-Correction: Hapus shift yatim (orphaned) dari lokal jika User ID sudah terhapus di server (Foreign Key Violation)
        if (error.code === '23503' || error.message?.includes('foreign key constraint')) {
          console.warn(`Menghapus shift lokal yang yatim (Orphaned): ${shift.id}`);
          await db.shifts.delete(shift.id);
        }
      } else {
        syncedCount++;
      }
    }
    return { success: true, syncedCount };
  } catch (err) {
    console.error('Error syncing shifts:', err);
    return { success: false, syncedCount: 0, error: err instanceof Error ? err.message : 'Terjadi kesalahan' };
  }
}

/**
 * Sync all pending (unsynced) transactions to Supabase.
 * Performs atomic operations: header → items → stock deduction → payment splits → returns.
 * Marks transactions as synced only when ALL steps succeed.
 * @param storeId - Optional filter to sync only transactions for a specific store
 * @returns Success status, count of synced transactions, and error if failed
 */
export async function syncPendingTransactions(storeId?: string) {
  const guard = await syncGuard();
  if (!guard.auth) return { success: false, syncedCount: 0, error: guard.offline ? 'Offline' : 'Unauthenticated' };

  try {
    let allUnsynced = await db.transactions.where('sync_status').equals(0).toArray();

    if (storeId) {
      allUnsynced = allUnsynced.filter(tx => tx.store_id === storeId);
    }

    // Skip transactions abandoned after 5 failed sync attempts
    allUnsynced = allUnsynced.filter(tx => (tx.sync_retries ?? 0) < 5);

    if (allUnsynced.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    let syncedCount = 0;

    for (const tx of allUnsynced) {
      let txSynced = false;
      try {
        // Fetch transaction items for this transaction
        const items = await db.transactionItems
          .where('transaction_id')
          .equals(tx.id)
          .toArray();

        const supabaseTx = {
          id: tx.id,
          store_id: tx.store_id,
          shift_id: tx.shift_id,
          total_amount: Number(tx.total_amount),
          tax: Number(tx.tax),
          discount: Number(tx.discount ?? 0),
          customer_id: tx.customer_id || null,
          payment_method: tx.payment_method,
          status: tx.status || 'COMPLETED',
          created_at: tx.created_at
        };

        const supabaseItems = items.map((item) => ({
          id: item.id,
          transaction_id: item.transaction_id,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          price: Number(item.price),
          discount: Number(item.discount ?? 0),
          subtotal: Number(item.subtotal)
        }));

        // Step 1: Check if transaction header already exists on Supabase
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('id', tx.id)
          .maybeSingle();

        // Step 2: Send transaction header only if it doesn't exist (idempotent)
        if (!existingTx) {
          const { error: txError } = await supabase
            .from('transactions')
            .upsert(supabaseTx);

          if (txError) {
            throw new Error(`Transaction header sync failed: ${txError.message}`);
          }
        }

        // Step 3: Send transaction items (idempotent upsert)
        let itemsAlreadySynced = false;
        if (supabaseItems.length > 0) {
          // Check if items were already synced BEFORE upsert (prevents double stock)
          if (existingTx) {
            const { data: existingItems } = await supabase
              .from('transaction_items')
              .select('id')
              .eq('transaction_id', tx.id)
              .limit(1);

            if (existingItems && existingItems.length > 0) {
              itemsAlreadySynced = true;
            }
          }

          if (!itemsAlreadySynced) {
            const { error: itemsError } = await supabase
              .from('transaction_items')
              .upsert(supabaseItems);

            if (itemsError) {
              throw new Error(`Transaction items sync failed: ${itemsError.message}`);
            }
          }

          // Step 5: Atomic stock deduction via RPC (skip if items already synced or already deducted)
          if (!itemsAlreadySynced && !tx.stock_deducted) {
            for (const item of supabaseItems) {
              const { error: stockError } = await supabase.rpc('decrement_product_stock', {
                p_product_id: item.product_id,
                p_quantity: item.quantity,
                p_store_id: tx.store_id,
                p_reason: `Sync: Penjualan ${item.quantity}x`,
              });

              if (stockError) {
                console.warn(`Failed to sync stock for product ${item.product_id}:`, stockError);
                // Stock RPC failure is non-fatal (can be retried independently)
              }
            }
            // Mark stock as deducted locally so crash mid-sync won't double-deduct
            await db.transactions.update(tx.id, { stock_deducted: true });
          }
        }

        // Step 6: Sync payment splits
        const splits = await db.paymentSplits.where('transaction_id').equals(tx.id).toArray();
        if (splits.length > 0) {
          const { error: splitsError } = await supabase.from('payment_splits').upsert(
            splits.map(s => ({ id: s.id, transaction_id: s.transaction_id, method: s.method, amount: Number(s.amount) }))
          );
          if (splitsError) {
            console.warn(`Split sync error for ${tx.id}:`, splitsError);
            // Non-fatal, continue
          }
        }

        // Step 7: Sync returns for this transaction (if any)
        const returns = await db.returns.where('transaction_id').equals(tx.id).toArray();
        for (const ret of returns) {
          const { error: retError } = await supabase.from('returns').upsert({
            id: ret.id, store_id: ret.store_id, transaction_id: ret.transaction_id,
            user_id: ret.user_id, items: ret.items, reason: ret.reason,
            refund_amount: Number(ret.refund_amount), created_at: ret.created_at,
          });
          if (retError) {
            console.warn(`Return sync error for ${tx.id}:`, retError);
            continue;
          }

          // Atomic stock increment for refunded items
          const retItems = Array.isArray(ret.items) ? ret.items : [];
          for (const retItem of retItems) {
            const { error: stockIncError } = await supabase.rpc('increment_product_stock', {
              p_product_id: retItem.product_id,
              p_quantity: retItem.quantity,
              p_store_id: ret.store_id,
              p_user_id: ret.user_id,
              p_reason: `Sync: Refund - ${ret.reason}`,
            });
            if (stockIncError) console.warn(`Failed to restore stock for refund ${ret.id}:`, stockIncError);
          }
        }

        // All steps passed - mark as synced locally
        await db.transactions.update(tx.id, { sync_status: true });
        txSynced = true;
      } catch (err) {
        const retries = (tx.sync_retries ?? 0) + 1;
        console.error(`Sync failed for transaction ${tx.id} (attempt ${retries}):`, err);
        if (retries >= 5) {
          console.warn(`⚠️ Transaksi ${tx.id} gagal sync 5 kali. Data tetap disimpan lokal. Periksa koneksi atau hubungi admin.`);
          await db.transactions.update(tx.id, { sync_retries: retries });
        } else {
          await db.transactions.update(tx.id, { sync_retries: retries });
        }
      }

      if (txSynced) {
        syncedCount++;
      }
    }

    return { success: true, syncedCount };
  } catch (err) {
    console.error('Error during transaction sync:', err);
    return { success: false, syncedCount: 0, error: err instanceof Error ? err.message : 'Terjadi kesalahan' };
  }
}

/**
 * Sync all pending returns (refunds) to Supabase.
 * Restores product stock for refunded items via atomic RPC.
 * Only syncs returns where sync_status === false.
 * @returns Success status, count of synced returns, and error if failed
 */
export async function syncPendingReturns(storeId?: string) {
  const guard = await syncGuard();
  if (!guard.auth) return { success: false, syncedCount: 0, error: guard.offline ? 'Offline' : 'Unauthenticated' };

  try {
    // Filter unsynced returns only
    const allReturns = await db.returns.where('sync_status').equals(0).toArray();
    const pendingReturns = storeId ? allReturns.filter(r => r.store_id === storeId) : allReturns;

    if (pendingReturns.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    let syncedCount = 0;

    for (const ret of pendingReturns) {
      let retSynced = false;
      try {
        const { error: retError } = await supabase.from('returns').upsert({
          id: ret.id, store_id: ret.store_id, transaction_id: ret.transaction_id,
          user_id: ret.user_id, items: ret.items, reason: ret.reason,
          refund_amount: Number(ret.refund_amount), created_at: ret.created_at,
        });

        if (retError) {
          throw new Error(`Return sync failed: ${retError.message}`);
        }

        // Atomic stock increment for refunded items
        const retItems = Array.isArray(ret.items) ? ret.items : [];
        let allStockSynced = true;
        for (const retItem of retItems) {
          const { error: stockIncError } = await supabase.rpc('increment_product_stock', {
            p_product_id: retItem.product_id,
            p_quantity: retItem.quantity,
            p_store_id: ret.store_id,
            p_reason: `Sync: Refund - ${ret.reason}`,
          });
          if (stockIncError) {
            console.warn(`Failed to restore stock for refund ${ret.id}:`, stockIncError);
            allStockSynced = false;
          }
        }

        if (allStockSynced) {
          // Mark return as synced locally
          await db.returns.update(ret.id, { sync_status: true });
          retSynced = true;
        }
      } catch (err) {
        console.error(`Sync failed for return ${ret.id}:`, err);
        // Do NOT mark as synced - will be retried
      }

      if (retSynced) {
        syncedCount++;
      }
    }

    return { success: true, syncedCount };
  } catch (err) {
    console.error('Error during return sync:', err);
    return { success: false, syncedCount: 0, error: err instanceof Error ? err.message : 'Terjadi kesalahan' };
  }
}

/**
 * Sync all pending activity logs to Supabase.
 * Activity logs are audit trail entries created during checkout/refund.
 * @param storeId - Optional filter to sync only logs for a specific store
 */
export async function syncActivityLogs(storeId?: string) {
  const guard = await syncGuard();
  if (!guard.auth) return { success: false, syncedCount: 0, error: guard.offline ? 'Offline' : 'Unauthenticated' };

  try {
    let logs = await db.activityLogs
      .where('sync_status')
      .equals(0)
      .toArray();

    if (storeId) {
      logs = logs.filter(l => l.store_id === storeId);
    }

    if (logs.length === 0) return { success: true, syncedCount: 0 };

    let syncedCount = 0;
    for (const log of logs) {
      const { error } = await supabase.from('activity_logs').upsert({
        id: log.id,
        store_id: log.store_id,
        user_id: log.user_id,
        action: log.action,
        description: log.description,
        created_at: log.created_at,
      }, { onConflict: 'id' });
      if (!error) {
        await db.activityLogs.update(log.id, { sync_status: true });
        syncedCount++;
      }
    }
    return { success: true, syncedCount };
  } catch (err) {
    console.error('Error syncing activity logs:', err);
    return { success: false, syncedCount: 0, error: err instanceof Error ? err.message : 'Sync activity logs failed' };
  }
}

/**
 * Sync all pending admin CRUD operations (categories, products, customers).
 * These are operations queued when the app was offline.
 * Retries the Supabase call and marks as synced on success.
 * On failure, increments retry_count and gives up after 5 attempts.
 * @param storeId - Optional filter
 */
export async function syncPendingOps(storeId?: string) {
  const guard = await syncGuard();
  if (!guard.auth) return { success: false, syncedCount: 0, error: guard.offline ? 'Offline' : 'Unauthenticated' };

  try {
    let pending = await db.pendingOps
      .where('sync_status')
      .equals(0)
      .toArray();

    if (storeId) {
      pending = pending.filter(op => op.store_id === storeId);
    }

    if (pending.length === 0) return { success: true, syncedCount: 0 };

    let syncedCount = 0;
    for (const op of pending) {
      if (op.retry_count >= 5) {
        console.warn(`Dropping pending op ${op.id} after 5 retries`);
        await db.pendingOps.delete(op.id);
        continue;
      }

      let opError: unknown = null;
      const genericTables = [
        'categories', 'products', 'customers', 'suppliers',
        'product_batches', 'warehouses', 'warehouse_stocks', 'user_permissions'
      ];

      if (genericTables.includes(op.table)) {
        const p = op.payload as Record<string, unknown>;
        if (op.operation === 'CREATE' || op.operation === 'UPDATE') {
          const { error } = await supabase.from(op.table).upsert({ id: op.record_id, store_id: op.store_id, ...p });
          opError = error;
        } else if (op.operation === 'DELETE') {
          const { error } = await supabase.from(op.table).delete().eq('id', op.record_id).eq('store_id', op.store_id);
          opError = error;
        }
      } else {
        switch (op.table) {
          case 'debt_payments': {
            const p = op.payload as { debt_id: string; amount: number; payment_method: string; notes?: string };
            if (op.operation === 'CREATE') {
              const { error: payError } = await supabase.from('debt_payments').insert({
                id: op.record_id,
                store_id: op.store_id,
                debt_id: p.debt_id,
                amount: p.amount,
                payment_method: p.payment_method,
                notes: p.notes || null,
              });
              if (!payError) {
                await supabase.rpc('apply_debt_payment', { p_debt_id: p.debt_id, p_amount: p.amount });
              }
              opError = payError;
            }
            break;
          }
          case 'purchase_orders': {
            const p = op.payload as { supplier_id: string; items?: { product_id: string; quantity: number; unit_price: number }[]; status?: string };
            if (op.operation === 'CREATE') {
              const { error } = await supabase.from('purchase_orders').insert({
                id: op.record_id, store_id: op.store_id, supplier_id: p.supplier_id, total_amount: 0, status: 'PENDING',
              });
              opError = error;
            } else if (op.operation === 'UPDATE') {
              const { error } = await supabase.from('purchase_orders').update({ status: p.status }).eq('id', op.record_id).eq('store_id', op.store_id);
              opError = error;
            }
            break;
          }
        }
      }

      if (opError) {
        console.warn(`Failed to sync pending op ${op.id} (${op.table}.${op.operation}):`, opError);
        await db.pendingOps.update(op.id, { retry_count: op.retry_count + 1 });
      } else {
        await db.pendingOps.update(op.id, { sync_status: true });
        syncedCount++;
      }
    }
    return { success: true, syncedCount };
  } catch (err) {
    console.error('Error syncing pending ops:', err);
    return { success: false, syncedCount: 0, error: err instanceof Error ? err.message : 'Sync failed' };
  }
}

/**
 * Master sync function — orchestrates shifts, transactions, returns, activity logs, and pending ops sync.
 * Called by background sync interval and manual sync button.
 * @param storeId - Optional filter to sync only data for a specific store
 * @returns Combined success status, total synced count, and error if any
 */
async function doSync(storeId?: string) {
  const shiftResult = await syncShifts(storeId);
  const txResult = await syncPendingTransactions(storeId);
  const returnResult = await syncPendingReturns(storeId);
  const logResult = await syncActivityLogs(storeId);
  const opsResult = await syncPendingOps(storeId);

  return {
    success: shiftResult.success && txResult.success && returnResult.success && logResult.success && opsResult.success,
    syncedCount: (shiftResult.syncedCount || 0) + (txResult.syncedCount || 0) + (returnResult.syncedCount || 0) + (logResult.syncedCount || 0) + (opsResult.syncedCount || 0),
    error: txResult.error || returnResult.error || shiftResult.error || logResult.error || opsResult.error || null
  };
}

export async function triggerSync(storeId?: string) {
  if (!navigator.onLine) {
    return { success: false, message: 'Offline. Sync skipped.' };
  }

  // Cross-tab mutex vianavigator.locks — prevents concurrent sync from multiple tabs
  if ('locks' in navigator) {
    return await navigator.locks.request('tokoku-sync', { ifAvailable: true }, async (lock) => {
      if (!lock) {
        console.warn('Sync skipped — another tab is already syncing');
        return { success: false, message: 'Sync already in progress in another tab' };
      }
      return doSync(storeId);
    });
  }

  // Fallback for Safari and other browsers without Lock API
  return doSync(storeId);
}

/**
 * Delete synced transactions, transaction items, payment splits, returns, debts, activity logs,
 * and stock history that are older than 30 days.
 */
export async function cleanupSyncedData() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateLimit = thirtyDaysAgo.toISOString();

    const allTxs = await db.transactions.toArray();
    const toDelete = allTxs.filter(tx => (tx.sync_status === true || (tx.sync_retries ?? 0) >= 5) && tx.created_at < dateLimit);
    
    if (toDelete.length > 0) {
      const txIds = toDelete.map(tx => tx.id);
      
      await db.transaction('rw', [
        db.transactions, db.transactionItems, db.paymentSplits,
        db.returns, db.customerDebts, db.activityLogs, db.stockHistory,
      ], async () => {
        await db.transactionItems.where('transaction_id').anyOf(txIds).delete();
        await db.paymentSplits.where('transaction_id').anyOf(txIds).delete();
        await db.returns.where('transaction_id').anyOf(txIds).delete();
        await db.customerDebts.where('transaction_id').anyOf(txIds).delete();
        await db.transactions.bulkDelete(txIds);
      });
      console.log(`Cleaned up ${toDelete.length} old synced transactions with related records.`);
    }

    // Clean up orphaned activity logs and stock history by date (no transaction_id FK)
    const cleanedLogs = await db.activityLogs
      .where('created_at')
      .below(dateLimit)
      .delete();
    if (cleanedLogs > 0) console.log(`Cleaned up ${cleanedLogs} old activity logs.`);

    const cleanedStock = await db.stockHistory
      .where('created_at')
      .below(dateLimit)
      .delete();
    if (cleanedStock > 0) console.log(`Cleaned up ${cleanedStock} old stock history records.`);
  } catch (err) {
    console.error('Failed to run periodic cleanup:', err);
  }
}
