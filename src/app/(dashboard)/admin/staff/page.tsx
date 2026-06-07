'use client';

import React, { useState, useEffect, useCallback, startTransition } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { invitesApi, membersApi, activityApi, userPermissionsApi } from '@/lib/api';
import { db } from '@/lib/dexie';
import ConfirmModal from '@/components/ConfirmModal';
import { StaffTab } from '@/components/admin';
import { type StoreMember, type Invite, type MemberRow } from '@/types';

export default function StaffPage() {
  const { user, activeStore, activeRole } = useAuthStore();
  const [members, setMembers] = useState<StoreMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [search, setSearch] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'KASIR'>('KASIR');
  const [inviteMaxUses, setInviteMaxUses] = useState(10);
  const [inviteExpiry, setInviteExpiry] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteCooldown, setInviteCooldown] = useState(false);

  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});

  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null);

  const logActivity = async (action: string, description: string) => {
    if (!activeStore?.id || !user?.id) return;
    try {
      await activityApi.log(activeStore.id, user.id, action, description);
    } catch (err) { console.warn('Activity log gagal:', err); }
  };

  const loadData = useCallback(async () => {
    if (!activeStore) return;
    try {
      const { data: memberData, error: memberError } = await membersApi.list(activeStore.id);
      if (memberError) throw memberError;
      const mapped = (memberData || []).map((m: MemberRow) => {
        const u = Array.isArray(m.users) ? (m.users as Record<string, string>[])[0] : (m.users as Record<string, string>);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          user_email: u?.email || '',
          user_name: u?.full_name || '',
          created_at: m.created_at,
        };
      });
      setMembers(mapped);

      // Load permissions
      const localPerms = await db.userPermissions.where('store_id').equals(activeStore.id).toArray();
      const permMap: Record<string, Record<string, boolean>> = {};
      for (const p of localPerms) {
        if (!permMap[p.user_id]) permMap[p.user_id] = {};
        permMap[p.user_id][p.permission_key] = p.enabled;
      }
      
      // Load remote permissions if online
      if (navigator.onLine) {
        const { data: remotePerms } = await userPermissionsApi.list(activeStore.id);
        if (remotePerms) {
          await db.transaction('rw', db.userPermissions, async () => {
            await db.userPermissions.bulkPut(remotePerms);
          });
          for (const p of remotePerms) {
            if (!permMap[p.user_id]) permMap[p.user_id] = {};
            permMap[p.user_id][p.permission_key] = p.enabled;
          }
        }
      }
      setPermissions(permMap);

      const { data: inviteData, error: inviteError } = await invitesApi.list(activeStore.id);
      if (!inviteError && inviteData?.success) {
        const raw = inviteData.invites;
        setInvites(Array.isArray(raw) ? raw : []);
      }
    } catch (err) {
      useToastStore.getState().addToast(err instanceof Error ? err.message : 'Gagal memuat data.', 'error');
    }
  }, [activeStore]);

  const togglePermission = async (userId: string, key: string, currentEnabled: boolean) => {
    if (!activeStore) return;
    try {
      const nextEnabled = !currentEnabled;
      await userPermissionsApi.update(activeStore.id, userId, key, nextEnabled);
      useToastStore.getState().addToast('Izin akses berhasil diubah.', 'success');
      loadData();
    } catch {
      useToastStore.getState().addToast('Gagal mengubah izin.', 'error');
    }
  };

  useEffect(() => {
    if (activeStore) {
      startTransition(() => {
        loadData();
      });
    }
  }, [activeStore, loadData]);

  const generateInviteCode = async () => {
    if (!activeStore || !user) return;
    setGeneratingInvite(true);
    try {
      const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      const code = Array.from(bytes, (b) => charset[b % charset.length]).join('');
      const expiresAt = inviteExpiry ? new Date(inviteExpiry).toISOString() : undefined;
      const { error } = await invitesApi.create(activeStore.id, code, inviteRole, user.id, inviteMaxUses, expiresAt);
      if (error) throw error;
      setInviteCode(code);
      useToastStore.getState().addToast('Kode undangan berhasil dibuat!', 'success');
      setInviteCooldown(true);
      setTimeout(() => setInviteCooldown(false), 10000);
      await loadData();
    } catch (err) {
      useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleRevoke = (inviteId: string) => {
    setConfirm({
      title: 'Cabut Undangan',
      message: 'Kode undangan ini tidak bisa lagi digunakan. Lanjutkan?',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const { data, error } = await invitesApi.revoke(inviteId);
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          useToastStore.getState().addToast('Undangan berhasil dicabut.', 'success');
          await loadData();
        } catch (err) {
          useToastStore.getState().addToast(err instanceof Error ? err.message : 'Gagal mencabut undangan.', 'error');
        }
      },
    });
  };

  const handleAddMember = async (email: string, role: 'ADMIN' | 'KASIR') => {
    if (!activeStore) return;
    try {
      const { data, error } = await membersApi.addDirect(activeStore.id, email, role);
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      useToastStore.getState().addToast('Anggota berhasil ditambahkan.', 'success');
      await loadData();
    } catch (err) {
      useToastStore.getState().addToast(err instanceof Error ? err.message : 'Gagal menambahkan anggota.', 'error');
    }
  };

  const removeMember = (memberId: string, memberRole: string) => {
    if (!activeStore) return;
    setConfirm({
      title: 'Hapus Anggota',
      message: 'Yakin ingin menghapus anggota ini (' + memberRole + ')?',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const member = members.find((m) => m.id === memberId);
          const { error } = await membersApi.remove(activeStore.id, memberId);
          if (error) throw error;
          logActivity('REMOVE_MEMBER', 'Anggota ' + (member?.user_name || '') + ' (' + memberRole + ') dihapus');
          useToastStore.getState().addToast('Anggota dihapus.', 'success');
          loadData();
        } catch (err) {
          useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
        }
      },
    });
  };

  const changeRole = async (memberId: string, newRole: string) => {
    if (!activeStore) return;
    try {
      const member = members.find((m) => m.id === memberId);
      const { error } = await membersApi.updateRole(activeStore.id, memberId, newRole);
      if (error) throw error;
      logActivity(
        'CHANGE_ROLE',
        'Role ' +
          (member?.user_name || '') +
          ' menjadi ' +
          (newRole === 'OWNER' ? 'Pemilik' : newRole === 'ADMIN' ? 'Admin' : 'Kasir')
      );
      useToastStore.getState().addToast(
        'Role diubah menjadi ' + (newRole === 'OWNER' ? 'Pemilik' : newRole === 'ADMIN' ? 'Admin' : 'Kasir') + '.',
        'success'
      );
      loadData();
    } catch (err) {
      useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    }
  };

  const isOwner = activeRole === 'OWNER';

  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden p-6">
      <StaffTab
        members={members}
        invites={invites}
        activeRole={activeRole}
        isOwner={isOwner}
        search={search}
        onSearchChange={setSearch}
        onGenerateInvite={generateInviteCode}
        onRevokeInvite={handleRevoke}
        onRemoveMember={removeMember}
        onChangeRole={changeRole}
        onAddMember={handleAddMember}
        inviteCode={inviteCode}
        inviteRole={inviteRole}
        inviteMaxUses={inviteMaxUses}
        inviteExpiry={inviteExpiry}
        generatingInvite={generatingInvite || inviteCooldown}
        onInviteRoleChange={setInviteRole}
        onInviteMaxUsesChange={setInviteMaxUses}
        onInviteExpiryChange={setInviteExpiry}
        permissions={permissions}
        onTogglePermission={togglePermission}
      />

      {confirm && (
        <ConfirmModal
          open={!!confirm}
          title={confirm.title}
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
