'use client';

import { useState } from 'react';
import { Plus, Mail, Calendar, Clock, X, Search, Trash2, KeyRound, Crown, Shield, User, Loader2, Copy } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import { useDebounce } from '@/hooks/useDebounce';
import { useToastStore } from '@/store/toastStore';

interface StoreMember { id: string; user_id: string; role: string; user_email: string; user_name: string; created_at?: string; }
interface Invite { id: string; code: string; role: string; max_uses: number; used_count: number; expires_at: string | null; created_at: string; is_expired: boolean; is_full: boolean; }

interface StaffTabProps {
  members: StoreMember[];
  invites: Invite[];
  activeRole: string | null;
  isOwner: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  onGenerateInvite: () => void;
  onRevokeInvite: (id: string) => void;
  onRemoveMember: (id: string, role: string) => void;
  onChangeRole: (id: string, role: string) => void;
  onAddMember: (email: string, role: 'ADMIN' | 'KASIR') => void;
  inviteCode: string | null;
  inviteRole: 'ADMIN' | 'KASIR';
  inviteMaxUses: number;
  inviteExpiry: string;
  generatingInvite: boolean;
  onInviteRoleChange: (r: 'ADMIN' | 'KASIR') => void;
  onInviteMaxUsesChange: (n: number) => void;
  onInviteExpiryChange: (d: string) => void;
}

const roleIcon: Record<string, React.ComponentType<{ className?: string }>> = { OWNER: Crown, ADMIN: Shield, KASIR: User };
const roleLabel: Record<string, string> = { OWNER: 'Pemilik', ADMIN: 'Admin', KASIR: 'Kasir' };

export default function StaffTab({
  members, invites, activeRole, isOwner, search, onSearchChange,
  onGenerateInvite, onRevokeInvite, onRemoveMember, onChangeRole, onAddMember,
  inviteCode, inviteRole, inviteMaxUses, inviteExpiry, generatingInvite,
  onInviteRoleChange, onInviteMaxUsesChange, onInviteExpiryChange,
}: StaffTabProps) {
  const [showAddMember, setShowAddMember] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<'ADMIN' | 'KASIR'>('KASIR');
  const [addingMember, setAddingMember] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const filteredMembers = members.filter(m =>
    m.user_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    m.user_email.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAddingMember(true);
    try {
      await onAddMember(addEmail.trim(), addRole);
      setShowAddMember(false);
      setAddEmail('');
    } finally { setAddingMember(false); }
  };

  const handleRevoke = (inviteId: string) => {
    setConfirm({ title: 'Cabut Undangan', message: 'Kode undangan ini tidak bisa lagi digunakan. Lanjutkan?', danger: true, onConfirm: () => {
      setConfirm(null);
      onRevokeInvite(inviteId);
    }});
  };

  const handleRemoveMember = (memberId: string, memberRole: string) => {
    setConfirm({ title: 'Hapus Anggota', message: 'Yakin ingin menghapus anggota ini (' + memberRole + ')?', danger: true, onConfirm: () => {
      setConfirm(null);
      onRemoveMember(memberId, memberRole);
    }});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans font-bold text-2xl text-ink">Kelola Staf</h1>
          <p className="text-slate font-sans text-sm mt-1">Kelola anggota dan kode undangan toko ini</p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <button onClick={() => setShowAddMember(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-success text-white text-sm font-semibold rounded-lg hover:bg-success/90 transition-colors cursor-pointer">
              <Plus className="w-4 h-4" /> Tambah Anggota
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface p-6 rounded-xl border border-hairline">
            <h3 className="font-sans font-bold text-[18px] text-ink flex items-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-primary" /> Buat Kode Undangan
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Peran</label>
                <select value={inviteRole} onChange={(e) => onInviteRoleChange(e.target.value as 'ADMIN' | 'KASIR')} className="w-full bg-surface border border-hairline rounded-lg px-3 h-[48px] text-[14px] focus:outline-none focus:border-primary font-sans">
                  <option value="KASIR">Kasir</option>
                  {isOwner && <option value="ADMIN">Admin</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Maksimum Pemakaian</label>
                <input type="number" min="1" max="100" value={inviteMaxUses} onChange={(e) => onInviteMaxUsesChange(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-mono" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Kadaluarsa (opsional)</label>
                <input type="datetime-local" value={inviteExpiry} onChange={(e) => onInviteExpiryChange(e.target.value)} className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans" />
              </div>
              <button onClick={onGenerateInvite} disabled={generatingInvite} className="w-full bg-primary text-on-primary font-semibold text-[14px] h-[48px] rounded-lg hover:bg-primary-pressed transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60">
                {generatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buat Kode Undangan'}
              </button>
              {inviteCode && (
                <div className="bg-canvas border border-hairline rounded-lg p-4 text-center space-y-2">
                  <p className="text-xs text-slate font-sans">Bagikan kode ini:</p>
                  <p className="font-mono font-bold text-2xl text-primary tracking-[0.2em]">{inviteCode}</p>
                  <button onClick={() => { navigator.clipboard.writeText(inviteCode); useToastStore.getState().addToast('Kode disalin!', 'success'); }} className="text-xs text-primary font-semibold flex items-center gap-1 mx-auto cursor-pointer hover:underline">
                    <Copy className="w-3 h-3" /> Salin Kode
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
            <div className="p-4 border-b border-hairline bg-surface-muted">
              <h3 className="font-sans font-bold text-[16px] text-ink">Kode Undangan ({invites.length})</h3>
            </div>
            <div className="divide-y divide-hairline max-h-[400px] overflow-y-auto">
              {invites.length === 0 ? (
                <div className="p-8 text-center text-slate font-sans text-sm">Belum ada kode undangan.</div>
              ) : invites.map(inv => (
                <div key={inv.id} className="p-4 hover:bg-surface-muted">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-sm text-ink tracking-wider">{inv.code}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate font-sans">
                        <span className={'px-1.5 py-0.5 rounded text-[11px] font-semibold ' + (inv.role === 'ADMIN' ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary')}>{roleLabel[inv.role]}</span>
                        <span>{inv.used_count}/{inv.max_uses} terpakai</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted font-sans">
                        {inv.expires_at && (
                          <span className={inv.is_expired ? 'text-danger' : ''}><Calendar className="w-3 h-3 inline mr-0.5" />{formatDate(inv.expires_at)}</span>
                        )}
                        <span><Clock className="w-3 h-3 inline mr-0.5" />{formatDate(inv.created_at)}</span>
                      </div>
                    </div>
                    {!inv.is_expired && !inv.is_full && (
                      <button onClick={() => handleRevoke(inv.id)} className="p-1.5 text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer" title="Cabut undangan">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {(inv.is_expired || inv.is_full) && (
                    <span className="inline-block mt-2 text-[11px] font-semibold text-muted bg-canvas px-2 py-0.5 rounded">
                      {inv.is_expired ? 'Kedaluwarsa' : 'Penuh'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
            <div className="p-4 border-b border-hairline bg-surface-muted flex items-center justify-between gap-3">
              <h3 className="font-sans font-bold text-[16px] text-ink">Anggota ({filteredMembers.length})</h3>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel" />
                <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Cari nama/email..." className="w-full bg-surface border border-hairline rounded-lg pl-9 pr-3 h-[40px] text-[13px] focus:outline-none focus:border-primary font-sans" />
              </div>
            </div>
            <div className="divide-y divide-hairline">
              {filteredMembers.map((m) => {
                const Icon = roleIcon[m.role] || User;
                return (
                  <div key={m.id} className="p-4 flex items-center justify-between hover:bg-surface-muted">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-primary" /></div>
                      <div className="min-w-0">
                        <p className="font-sans font-semibold text-sm text-ink truncate">{m.user_name || m.user_email}</p>
                        <p className="font-sans text-xs text-slate truncate">{m.user_email}</p>
                        {m.created_at && <p className="font-sans text-[11px] text-muted">Bergabung {formatDate(m.created_at)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {m.role !== 'OWNER' && isOwner && (
                        <select value={m.role} onChange={(e) => onChangeRole(m.id, e.target.value)} className="bg-surface border border-hairline rounded-lg px-2 h-[40px] text-[12px] focus:outline-none focus:border-primary font-sans cursor-pointer">
                          <option value="ADMIN">Admin</option>
                          <option value="KASIR">Kasir</option>
                        </select>
                      )}
                      {m.role === 'OWNER' && (
                        <span className="font-sans text-xs font-semibold text-warning bg-warning-soft px-2.5 py-1 rounded-lg flex items-center gap-1"><Crown className="w-3 h-3" />Pemilik</span>
                      )}
                      {m.role !== 'OWNER' && !isOwner && (
                        <span className="font-sans text-xs font-semibold text-slate bg-surface-muted px-2.5 py-1 rounded-lg">{roleLabel[m.role]}</span>
                      )}
                      {m.role !== 'OWNER' && (activeRole === 'OWNER' || activeRole === 'ADMIN') && (
                        <button onClick={() => handleRemoveMember(m.id, m.role)} className="p-2 text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer" title="Hapus anggota">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={() => setShowAddMember(false)}>
          <div className="bg-surface rounded-xl shadow-floating border border-hairline w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-sans font-bold text-[20px] text-ink flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /> Tambah Anggota</h3>
              <button aria-label="Tutup modal tambah anggota" onClick={() => setShowAddMember(false)} className="p-1 text-slate hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Email Anggota *</label>
                <input type="email" required value={addEmail} onChange={(e) => setAddEmail(e.target.value)} className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans" placeholder="nama@email.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Peran</label>
                <select value={addRole} onChange={(e) => setAddRole(e.target.value as 'ADMIN' | 'KASIR')} className="w-full bg-surface border border-hairline rounded-lg px-3 h-[48px] text-[14px] focus:outline-none focus:border-primary font-sans">
                  <option value="KASIR">Kasir</option>
                  {isOwner && <option value="ADMIN">Admin</option>}
                </select>
              </div>
              <button type="submit" disabled={addingMember} className="w-full bg-success text-white font-semibold text-[15px] h-[48px] rounded-lg hover:bg-success/90 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60">
                {addingMember ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Tambah Anggota'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        danger={confirm?.danger}
        confirmLabel={confirm?.danger ? 'Ya, Hapus' : 'Ya'}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
