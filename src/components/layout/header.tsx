'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { COMPANY } from '@/config';

interface HeaderProps {
  variant?: 'customer' | 'admin';
  userName?: string;
}

export function Header({ variant = 'customer', userName }: HeaderProps) {
  const pathname = usePathname();

  const isAdmin = variant === 'admin';
  const baseUrl = isAdmin ? '/admin' : '/account';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href={baseUrl} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2D5016]">
            <span className="text-lg font-bold text-white">P</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-gray-900">
              {COMPANY.name}
            </span>
            {isAdmin && (
              <span className="text-xs text-gray-500">Admin</span>
            )}
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          {isAdmin ? (
            <>
              <NavLink href="/admin" current={pathname === '/admin'}>
                Dashboard
              </NavLink>
              <NavLink
                href="/admin/orders"
                current={pathname.startsWith('/admin/orders')}
              >
                Bestellungen
              </NavLink>
              <NavLink
                href="/admin/settings"
                current={pathname.startsWith('/admin/settings')}
              >
                Einstellungen
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                href="/account"
                current={pathname === '/account'}
              >
                Übersicht
              </NavLink>
              <NavLink
                href="/account/orders"
                current={pathname.startsWith('/account/orders')}
              >
                Bestellungen
              </NavLink>
              <NavLink
                href="/account/settings"
                current={pathname.startsWith('/account/settings')}
              >
                Einstellungen
              </NavLink>
            </>
          )}
        </nav>

        {/* User menu */}
        <div className="flex items-center gap-4">
          {userName && (
            <span className="text-sm text-gray-600">{userName}</span>
          )}
          <Link
            href={isAdmin ? '/admin/logout' : '/account/logout'}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Abmelden
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'text-sm font-medium transition-colors',
        current
          ? 'text-[#2D5016]'
          : 'text-gray-600 hover:text-gray-900'
      )}
    >
      {children}
    </Link>
  );
}

