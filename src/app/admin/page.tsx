import { Metadata } from 'next';
import Link from 'next/link';
import { 
  Package, 
  Euro, 
  TrendingUp, 
  Clock,
  Mail,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
};

// Mock metrics for development
const mockMetrics = {
  today: {
    total_orders: 12,
    total_revenue_gross: 458900,
    by_type: { normal: 10, preorder: 2 },
    by_payment_method: { vorkasse: 5, lastschrift: 3, paypal: 2, klarna: 2 },
    by_country: { DE: 4, AT: 8 },
    orders_with_invoice: 8,
    orders_pending_email: 3,
  },
  yesterday: {
    total_orders: 8,
    total_revenue_gross: 312500,
    by_type: { normal: 7, preorder: 1 },
    by_payment_method: { vorkasse: 4, lastschrift: 2, paypal: 1, klarna: 1 },
    by_country: { DE: 3, AT: 5 },
    orders_with_invoice: 6,
    orders_pending_email: 1,
  },
  last_7_days: {
    total_orders: 67,
    total_revenue_gross: 2145000,
    by_type: { normal: 58, preorder: 9 },
    by_payment_method: { vorkasse: 28, lastschrift: 18, paypal: 12, klarna: 9 },
    by_country: { DE: 25, AT: 42 },
    orders_with_invoice: 52,
    orders_pending_email: 8,
  },
  all_time: {
    total_orders: 342,
    total_revenue_gross: 10850000,
    by_type: { normal: 298, preorder: 44 },
    by_payment_method: { vorkasse: 145, lastschrift: 89, paypal: 62, klarna: 46 },
    by_country: { DE: 128, AT: 214 },
    orders_with_invoice: 298,
    orders_pending_email: 12,
  },
};

function MetricCard({ 
  title, 
  value, 
  subValue,
  icon: Icon, 
  trend,
  href,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  href?: string;
}) {
  const content = (
    <Card className={href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
            {subValue && (
              <p className="text-sm text-gray-500 mt-1">{subValue}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className={`w-4 h-4 ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                <span className={`text-sm ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trend.value >= 0 ? '+' : ''}{trend.value}%
                </span>
                <span className="text-sm text-gray-500">{trend.label}</span>
              </div>
            )}
          </div>
          <div className="p-3 bg-[#2D5016]/10 rounded-lg">
            <Icon className="w-6 h-6 text-[#2D5016]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function AdminDashboard() {
  const metrics = mockMetrics;
  const userName = 'Admin';

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Header variant="admin" userName={userName} />

      <main className="container mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Übersicht aller Bestellungen und Metriken.
            </p>
          </div>
          <Link href="/admin/orders">
            <Button>
              Alle Bestellungen
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Today's metrics */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Heute</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Bestellungen"
              value={metrics.today.total_orders}
              subValue={`${metrics.today.by_type.normal} Normal / ${metrics.today.by_type.preorder} Vorbestellung`}
              icon={Package}
              trend={{ value: Math.round((metrics.today.total_orders / metrics.yesterday.total_orders - 1) * 100), label: 'vs. gestern' }}
              href="/admin/orders"
            />
            <MetricCard
              title="Umsatz (Brutto)"
              value={formatCurrency(metrics.today.total_revenue_gross, 'AT')}
              icon={Euro}
              trend={{ value: Math.round((metrics.today.total_revenue_gross / metrics.yesterday.total_revenue_gross - 1) * 100), label: 'vs. gestern' }}
            />
            <MetricCard
              title="Ausstehende E-Mails"
              value={metrics.today.orders_pending_email}
              subValue="Wochenend-Info / Bestätigung"
              icon={Mail}
              href="/admin/orders?filter=pending_email"
            />
            <MetricCard
              title="Rechnungen erstellt"
              value={`${metrics.today.orders_with_invoice} / ${metrics.today.total_orders}`}
              icon={FileText}
            />
          </div>
        </section>

        {/* 7-day summary */}
        <section className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Letzte 7 Tage</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Bestellungen"
              value={metrics.last_7_days.total_orders}
              icon={Package}
            />
            <MetricCard
              title="Umsatz (Brutto)"
              value={formatCurrency(metrics.last_7_days.total_revenue_gross, 'AT')}
              icon={Euro}
            />
            <MetricCard
              title="Durchschnitt/Tag"
              value={formatCurrency(Math.round(metrics.last_7_days.total_revenue_gross / 7), 'AT')}
              icon={TrendingUp}
            />
          </div>
        </section>

        {/* Breakdown cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nach Zahlungsmethode (7 Tage)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(metrics.last_7_days.by_payment_method).map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">
                      {method === 'vorkasse' ? 'Vorkasse' : 
                       method === 'lastschrift' ? 'Lastschrift' : 
                       method.charAt(0).toUpperCase() + method.slice(1)}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#2D5016] rounded-full"
                          style={{ width: `${(count / metrics.last_7_days.total_orders) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* By Country */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nach Land (7 Tage)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="default">AT</Badge>
                    <span className="text-sm font-medium">Österreich</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{metrics.last_7_days.by_country.AT}</p>
                    <p className="text-xs text-gray-500">
                      {Math.round((metrics.last_7_days.by_country.AT / metrics.last_7_days.total_orders) * 100)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="default">DE</Badge>
                    <span className="text-sm font-medium">Deutschland</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{metrics.last_7_days.by_country.DE}</p>
                    <p className="text-xs text-gray-500">
                      {Math.round((metrics.last_7_days.by_country.DE / metrics.last_7_days.total_orders) * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* All-time stats */}
        <section className="mt-8">
          <Card className="bg-[#2D5016] text-white">
            <CardContent className="p-6">
              <h2 className="text-lg font-medium mb-4">Gesamt (Alle Zeit)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-white/70">Bestellungen</p>
                  <p className="text-2xl font-semibold">{metrics.all_time.total_orders}</p>
                </div>
                <div>
                  <p className="text-sm text-white/70">Umsatz</p>
                  <p className="text-2xl font-semibold">{formatCurrency(metrics.all_time.total_revenue_gross, 'AT')}</p>
                </div>
                <div>
                  <p className="text-sm text-white/70">Normal</p>
                  <p className="text-2xl font-semibold">{metrics.all_time.by_type.normal}</p>
                </div>
                <div>
                  <p className="text-sm text-white/70">Vorbestellungen</p>
                  <p className="text-2xl font-semibold">{metrics.all_time.by_type.preorder}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

