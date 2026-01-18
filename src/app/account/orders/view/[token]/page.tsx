'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  MapPin,
  Package,
  CreditCard,
  Clock,
  User,
  Phone,
  Building,
  RefreshCw
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/orders/status-badge';
import { Order } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/config';
import { AuthUser } from '@/lib/auth';

export default function CustomerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndFetch();
  }, [token]);

  async function checkAuthAndFetch() {
    try {
      const authRes = await fetch('/api/auth/session');
      const authResult = await authRes.json();
      
      if (!authResult.success) {
        router.push('/account/login');
        return;
      }
      
      setUser(authResult.data.user);
      
      const response = await fetch(`/api/orders/token/${token}`);
      const result = await response.json();
      if (result.success) {
        setOrder(result.data.order);
      } else {
        router.push('/account/orders');
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

  if (!user || !order) return null;

  const paymentLabel = PAYMENT_METHODS[order.payment_method]?.label || order.payment_method;
  const addr = order.delivery_address;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-white to-[#f0f0e8]">
      <Header variant="customer" userName={user.name} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link 
          href="/account/orders"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zu Bestellungen
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Bestellung {order.order_no}
            </h1>
            <p className="text-gray-600 mt-1">
              {formatDate(order.created_at)}
            </p>
          </div>
          <StatusBadge status={order.status} className="text-base px-3 py-1" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5" />
                Artikel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} × {formatCurrency(item.unit_price_net, order.country)}
                      </p>
                    </div>
                    <p className="font-medium">
                      {formatCurrency(item.line_total_net, order.country)}
                    </p>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Zwischensumme (netto)</span>
                  <span>{formatCurrency(order.totals.subtotal_net, order.country)}</span>
                </div>
                {order.totals.shipping_net > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Versand</span>
                    <span>{formatCurrency(order.totals.shipping_net, order.country)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>{order.totals.vat_label} ({(order.totals.vat_rate * 100).toFixed(0)}%)</span>
                  <span>{formatCurrency(order.totals.vat_amount, order.country)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>Gesamt</span>
                  <span>{formatCurrency(order.totals.total_gross, order.country)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  Lieferadresse
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {order.company_name && (
                  <p className="font-medium flex items-center gap-2">
                    <Building className="w-4 h-4 text-gray-400" />
                    {order.company_name}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {order.customer_name}
                </p>
                <p className="pl-6">{addr.street} {addr.house_no}</p>
                <p className="pl-6">{addr.zip} {addr.city}</p>
                <p className="pl-6">{order.country === 'AT' ? 'Österreich' : 'Deutschland'}</p>
                {order.phone && (
                  <p className="flex items-center gap-2 mt-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {order.phone}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5" />
                  Zahlung
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{paymentLabel}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Status: {order.payment_status === 'paid' ? 'Bezahlt' : order.payment_status === 'pending' ? 'Ausstehend' : 'Erstattet'}
                </p>
              </CardContent>
            </Card>

            {order.delivery_date && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5" />
                    Liefertermin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{formatDate(order.delivery_date)}</p>
                  {order.delivery_window && (
                    <p className="text-sm text-gray-500">{order.delivery_window}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {order.invoice_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5" />
                    Rechnung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <a href={order.invoice_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full">
                      <FileText className="w-4 h-4 mr-2" />
                      Rechnung anzeigen
                    </Button>
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
