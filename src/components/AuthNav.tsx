'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, LogIn, UserPlus, Store, KeyRound, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function AuthNav() {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith('/onboarding');
  const { activeStore } = useAuthStore();

  const links = isOnboarding
    ? [
        ...(activeStore ? [{ href: '/cashier', label: 'Dashboard', icon: LayoutDashboard }] : []),
        { href: '/onboarding/create-store', label: 'Buat Toko', icon: Store },
        { href: '/onboarding/join-store', label: 'Gabung Toko', icon: KeyRound },
      ]
    : [
        { href: '/login', label: 'Masuk', icon: LogIn },
        { href: '/register', label: 'Daftar', icon: UserPlus },
      ];

  return (
    <nav className="mb-6">
      <div className="flex flex-wrap items-center gap-1">
        <Link
          href="/"
          className="text-slate hover:text-primary text-xs font-sans font-medium transition-colors flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-surface"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Beranda
        </Link>
        <span className="text-hairline mx-1">|</span>
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-on-primary'
                  : 'text-slate hover:text-primary hover:bg-surface'
              }`}
            >
              <Icon className="w-3 h-3" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
