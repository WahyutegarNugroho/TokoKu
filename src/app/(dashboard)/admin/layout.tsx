'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, FolderPlus, Users, BarChart3, UserCheck, History, Landmark, Receipt, Truck, ClipboardList, FileText, Tag, Calendar, Home } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { key: 'products', label: 'Kelola Produk', path: '/admin/products', icon: Package },
    { key: 'categories', label: 'Kategori', path: '/admin/categories', icon: FolderPlus },
    { key: 'promotions', label: 'Promo', path: '/admin/promotions', icon: Tag },
    { key: 'staff', label: 'Kelola Staf', path: '/admin/staff', icon: Users },
    { key: 'analytics', label: 'Analitik', path: '/admin/analytics', icon: BarChart3 },
    { key: 'reports', label: 'Laporan', path: '/admin/reports', icon: FileText },
    { key: 'customers', label: 'Pelanggan', path: '/admin/customers', icon: UserCheck },
    { key: 'activity', label: 'Log Aktivitas', path: '/admin/activity', icon: History },
    { key: 'stock', label: 'Riwayat Stok', path: '/admin/stock', icon: Landmark },
    { key: 'debts', label: 'Piutang', path: '/admin/debts', icon: Receipt },
    { key: 'suppliers', label: 'Supplier', path: '/admin/suppliers', icon: Truck },
    { key: 'purchase-orders', label: 'Pembelian', path: '/admin/purchase-orders', icon: ClipboardList },
    { key: 'batches', label: 'Batch & Expiry', path: '/admin/batches', icon: Calendar },
    { key: 'warehouses', label: 'Gudang', path: '/admin/warehouses', icon: Home },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-hairline overflow-x-auto scrollbar-thin -mx-4 md:mx-0 px-4 md:px-0 bg-surface rounded-xl p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.path || (tab.key === 'products' && pathname === '/admin');
          return (
            <Link
              key={tab.key}
              href={tab.path}
              className={`px-5 py-3 font-sans font-bold text-[14px] border-b-2 transition-colors flex items-center whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-primary text-primary bg-primary-soft/10'
                  : 'border-transparent text-slate hover:text-ink hover:bg-canvas/50'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Main Tab Content */}
      <div className="animate-in fade-in duration-200">
        {children}
      </div>
    </div>
  );
}
