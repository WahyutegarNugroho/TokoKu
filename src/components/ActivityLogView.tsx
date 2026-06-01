'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Props { storeId?: string; }

interface Log { id: string; action: string; description: string; user_name?: string; created_at: string; }

export default function ActivityLogView({ storeId }: Props) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!storeId) return;
    const fetchLogs = async (isRefresh = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      try {
        const { data } = await supabase
          .from('activity_logs')
          .select('id, action, description, user_id, created_at')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(100)
          .abortSignal(controller.signal);
        if (data) {
          const userIds = [...new Set(data.map(l => l.user_id))];
          const { data: users } = await supabase.from('users').select('id, full_name').in('id', userIds).abortSignal(controller.signal);
          const userMap = new Map((users || []).map(u => [u.id, u.full_name]));
          setLogs(data.map(l => ({ ...l, user_name: userMap.get(l.user_id) || 'Sistem' })));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        throw err;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    fetchLogs();
    const interval = setInterval(() => fetchLogs(true), 30000);
    return () => { clearInterval(interval); abortRef.current?.abort(); };
  }, [storeId]);

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center h-[300px]">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-5">
      {refreshing && (
        <div className="flex items-center gap-2 text-xs text-slate mb-3">
          <div className="animate-spin w-3 h-3 border border-primary border-t-transparent rounded-full" />
          Memperbarui data...
        </div>
      )}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full"><thead><tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-slate font-sans font-semibold"><th className="p-3 sticky top-0 bg-surface">Waktu</th><th className="p-3 sticky top-0 bg-surface">Pengguna</th><th className="p-3 sticky top-0 bg-surface">Aksi</th><th className="p-3 sticky top-0 bg-surface">Keterangan</th></tr></thead>
          <tbody className="divide-y divide-hairline">
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-surface-muted">
                <td className="p-3 text-slate text-xs font-mono">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                <td className="p-3 text-ink text-sm font-semibold">{l.user_name || 'Sistem'}</td>
                <td className="p-3"><span className="bg-primary-soft text-primary text-xs font-bold px-2 py-0.5 rounded-full">{l.action}</span></td>
                <td className="p-3 text-charcoal text-sm">{l.description}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate text-sm">Belum ada aktivitas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
