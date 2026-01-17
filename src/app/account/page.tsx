'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Package, ShoppingBag, FileText, CheckCircle2, Clock, Truck,
  MapPin, Calendar, Settings, TrendingUp, Flame, Award,
  ChevronRight, Sparkles, CreditCard
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AuthUser } from '@/lib/auth';
import { Order } from '@/types';

const ORDERS_FOR_RECHNUNG = 3;

export default function AccountDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalKg, setTotalKg] = useState(0);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  async function checkAuthAndLoadData() {
    try {
      const response = await fetch('/api/auth/session');
      const result = await response.json();

      if (result.success) {
        setUser(result.data.user);
        const ordersRes = await fetch('/api/orders/my');
        const ordersResult = await ordersRes.json();
        if (ordersResult.success) {
          const userOrders = ordersResult.data.orders as Order[];
          setOrders(userOrders);
          setCompletedCount(userOrders.filter(o => o.payment_status === 'paid' || o.status === 'delivered').length);

          // Calculate totals
          const spent = userOrders.reduce((sum, o) => sum + (o.totals?.total_gross || 0), 0);
          setTotalSpent(spent);

          const kg = userOrders.reduce((sum, o) => {
            return sum + o.items.reduce((itemSum, item) => {
              return itemSum + (item.unit === 'palette' ? item.quantity * 975 : item.quantity);
            }, 0);
          }, 0);
          setTotalKg(kg);
        }
      } else {
        router.push('/account/login');
      }
    } catch (error) {
      router.push('/account/login');
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-white to-[#f0f0e8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-3 border-[#2D5016] border-t-transparent animate-spin" />
          <span className="text-gray-500">Laden...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const rechnungUnlocked = completedCount >= ORDERS_FOR_RECHNUNG;
  const ordersRemaining = ORDERS_FOR_RECHNUNG - completedCount;
  const progressPercent = Math.min((completedCount / ORDERS_FOR_RECHNUNG) * 100, 100);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'received': return { label: 'Eingegangen', color: 'bg-blue-100 text-blue-700', icon: Clock };
      case 'confirmed': return { label: 'Bestätigt', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 };
      case 'planning_delivery': return { label: 'In Planung', color: 'bg-amber-100 text-amber-700', icon: Calendar };
      case 'shipped': return { label: 'Versandt', color: 'bg-purple-100 text-purple-700', icon: Truck };
      case 'in_transit': return { label: 'Unterwegs', color: 'bg-purple-100 text-purple-700', icon: Truck };
      case 'delivered': return { label: 'Geliefert', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
      case 'cancelled': return { label: 'Storniert', color: 'bg-red-100 text-red-700', icon: Clock };
      default: return { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock };
    }
  };

  const recentOrders = orders.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-white to-[#f0f0e8]">
      <Header variant="customer" userName={user.name} />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Welcome Section */}
        <div className="relative mb-8 p-8 rounded-3xl bg-gradient-to-br from-[#2D5016] via-[#3a6619] to-[#2D5016] text-white shadow-2xl overflow-hidden">
          {/* Animated particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white/20 animate-pulse"
                style={{
                  width: `${4 + (i % 3) * 2}px`,
                  height: `${4 + (i % 3) * 2}px`,
                  left: `${8 + i * 8}%`,
                  top: `${20 + (i % 4) * 20}%`,
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: `${2 + (i % 3)}s`,
                }}
              />
            ))}
          </div>

          {/* Pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <span className="text-white/80 text-sm font-medium">Willkommen zurück</span>
              </div>
              <h1 className="text-3xl font-bold mb-1">
                Hallo, {user.name.split(' ')[0]}!
              </h1>
              <p className="text-white/70">{user.email}</p>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
                <span className="text-4xl font-bold">{user.name.charAt(0)}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="relative z-10 grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold">{orders.length}</div>
              <div className="text-sm text-white/70">Bestellungen</div>
            </div>
            <div className="text-center border-x border-white/20">
              <div className="text-2xl font-bold">{(totalKg / 1000).toFixed(1)}t</div>
              <div className="text-sm text-white/70">Pellets bestellt</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
              <div className="text-sm text-white/70">Gesamtwert</div>
            </div>
          </div>
        </div>

        {/* Widgets Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Rechnung Progress Widget */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${rechnungUnlocked ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {rechnungUnlocked ? (
                    <Award className="w-6 h-6 text-green-600" />
                  ) : (
                    <CreditCard className="w-6 h-6 text-amber-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Kauf auf Rechnung</h3>
                  <p className="text-sm text-gray-500">
                    {rechnungUnlocked ? 'Freigeschaltet!' : `Noch ${ordersRemaining} Bestellungen`}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${rechnungUnlocked ? 'bg-green-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>{completedCount} / {ORDERS_FOR_RECHNUNG}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Widget */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Schnellzugriff
              </h3>
              <div className="space-y-2">
                <Link href="https://pelletor.de/bestellung.html" target="_blank" className="flex items-center justify-between p-3 rounded-xl bg-[#2D5016]/5 hover:bg-[#2D5016]/10 transition-colors group">
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="w-5 h-5 text-[#2D5016]" />
                    <span className="font-medium text-gray-900">Neue Bestellung</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#2D5016] transition-colors" />
                </Link>
                <Link href="/account/settings" className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Einstellungen</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Savings Widget */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Ihre Ersparnis</h3>
                  <p className="text-sm text-gray-500">durch Pelletor</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-emerald-600">
                ~{formatCurrency(Math.round(totalKg * 0.02 * 100))}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                vs. Öl-Heizung (geschätzt)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Letzte Bestellungen</h2>
            {orders.length > 3 && (
              <Link href="/account/orders" className="text-[#2D5016] hover:underline text-sm font-medium flex items-center gap-1">
                Alle anzeigen
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {orders.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Noch keine Bestellungen
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Bestellen Sie jetzt Ihre ersten Holzpellets und profitieren Sie von unseren günstigen Preisen.
                </p>
                <Link href="https://pelletor.de/bestellung.html" target="_blank">
                  <Button className="bg-[#2D5016] hover:bg-[#1a3009]">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Jetzt bestellen
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => {
                const statusInfo = getStatusInfo(order.status);
                const StatusIcon = statusInfo.icon;

                return (
                  <Card key={order.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-[#2D5016]/10 flex items-center justify-center">
                            <Package className="w-6 h-6 text-[#2D5016]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">#{order.order_no}</span>
                              <Badge className={statusInfo.color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">
                              {new Date(order.created_at).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900">
                            {formatCurrency(order.totals.total_gross)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.items.reduce((sum, i) => sum + (i.unit === 'palette' ? i.quantity * 975 : i.quantity), 0)} kg
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Help Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Fragen zu Ihrer Bestellung?</h3>
              <p className="text-sm text-gray-600">
                Unser Kundenservice hilft Ihnen gerne weiter.
              </p>
            </div>
            <a href="mailto:info@pelletor.de">
              <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                Kontakt
              </Button>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
