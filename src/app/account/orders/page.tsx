'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, RefreshCw } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrderCard } from '@/components/orders/order-card';
import { Order } from '@/types';
import { ProgressiveBackground } from '@/components/ui/progressive-background';

const BG_FULL = "https://srtsuzvjjcrliuaftvce.supabase.co/storage/v1/object/public/assets/bg-warehouse.png";
const BG_BLUR = "https://srtsuzvjjcrliuaftvce.supabase.co/storage/v1/object/public/assets/bg-warehouse-blur.png";

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  async function checkAuthAndFetch() {
    try {
      const authRes = await fetch('/api/auth/session');
      const authResult = await authRes.json();
      
      if (!authResult.success) {
        router.push('/account/login');
        return;
      }
      
      setUser(authResult.data.user);
      
      // Fetch customer orders
      const ordersRes = await fetch('/api/orders/my');
      const ordersResult = await ordersRes.json();
      
      if (ordersResult.success) {
        setOrders(ordersResult.data.orders);
      }
    } catch (error) {
      router.push('/account/login');
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-white to-[#f0f0e8] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-[#2D5016]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen relative">
      <ProgressiveBackground 
        src={BG_FULL} 
        blurSrc={BG_BLUR} 
        overlayClassName="bg-[#FAFAF8]/90" 
      />
      <Header variant="customer" userName={user.name} />

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Meine Bestellungen</h1>
            <p className="text-gray-600 mt-1">
              {orders.length} {orders.length === 1 ? 'Bestellung' : 'Bestellungen'}
            </p>
          </div>
          <Link href="https://pelletor.at/bestellung.html" target="_blank">
            <Button className="bg-[#2D5016] hover:bg-[#1a3009]">
              <Package className="w-4 h-4 mr-2" />
              Neue Bestellung
            </Button>
          </Link>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Noch keine Bestellungen</h3>
                <p className="text-gray-500 mb-6">
                  Sie haben noch keine Bestellungen aufgegeben. Bestellen Sie jetzt Ihre Holzpellets.
                </p>
                <Link href="https://pelletor.at/bestellung.html" target="_blank">
                  <Button className="bg-[#2D5016] hover:bg-[#1a3009]">
                    Erste Bestellung aufgeben
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                variant="customer"
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
