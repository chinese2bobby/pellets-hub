'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function doLogout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/admin/login');
    }
    doLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Logging out...</p>
    </div>
  );
}













