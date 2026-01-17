'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, FileText, Mail, MapPin, Package, Truck, CreditCard } from 'lucide-react';
import { Order } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { formatCurrency, formatDate, formatAddressOneLine } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/config';

interface OrderCardProps {
  order: Order;
  variant?: 'customer' | 'admin';
  selected?: boolean;
  onSelect?: (orderId: string, selected: boolean) => void;
  onAction?: (action: string, orderId: string) => void;
}

export function OrderCard({
  order,
  variant = 'customer',
  selected = false,
  onSelect,
  onAction
}: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isAdmin = variant === 'admin';
  const detailUrl = isAdmin
    ? `/admin/orders/${order.order_no}`
    : `/account/orders/${order.order_no}`;

  const paymentLabel = PAYMENT_METHODS[order.payment_method]?.label || order.payment_method;

  // E-Mail-Badges
  const emailBadges = [];
  if (order.email_flags.weekend_hello_sent) emailBadges.push('Begrüßung');
  if (order.email_flags.confirmation_sent) emailBadges.push('Bestätigt');
  if (order.email_flags.payment_instructions_sent) emailBadges.push('Zahlung');

  // Artikel berechnen
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const itemSummary = order.items.length > 0
    ? order.items.map(i => `${i.quantity}× ${i.name}`).join(', ')
    : 'Keine Artikel';

  const isCancelled = order.status === 'cancelled';

  // Kundenansicht - vereinfachtes, schöneres Layout
  if (!isAdmin) {
    return (
      <Card className={`overflow-hidden transition-all hover:shadow-lg border-0 shadow-md ${expanded ? 'ring-2 ring-[#2D5016]/20' : ''}`}>
        {/* Haupt-Header */}
        <div
          className="p-5 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                isCancelled ? 'bg-red-100' :
                order.status === 'delivered' ? 'bg-green-100' :
                order.status === 'shipped' || order.status === 'in_transit' ? 'bg-purple-100' :
                'bg-[#2D5016]/10'
              }`}>
                {order.status === 'shipped' || order.status === 'in_transit' ? (
                  <Truck className={`w-7 h-7 ${isCancelled ? 'text-red-600' : 'text-purple-600'}`} />
                ) : (
                  <Package className={`w-7 h-7 ${
                    isCancelled ? 'text-red-600' :
                    order.status === 'delivered' ? 'text-green-600' :
                    'text-[#2D5016]'
                  }`} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Bestellung #{order.order_no}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDate(order.created_at)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(order.totals.total_gross, order.country)}
              </p>
              <p className="text-sm text-gray-500">
                inkl. {order.totals.vat_label}
              </p>
            </div>
          </div>

          {/* Produkte kurz */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600 truncate flex-1">
              {itemSummary}
            </p>
            <div className="flex items-center gap-2 ml-4">
              <Badge variant="outline" className="text-xs">
                {totalItems} {totalItems === 1 ? 'Artikel' : 'Artikel'}
              </Badge>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {/* Erweiterte Details */}
        {expanded && (
          <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50 to-white">
            <div className="p-5 space-y-6">
              {/* Lieferadresse & Zahlung */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Lieferadresse</span>
                  </div>
                  <p className="font-medium text-gray-900">{order.customer_name}</p>
                  <p className="text-sm text-gray-600">{formatAddressOneLine(order.delivery_address)}</p>
                  {order.delivery_notes && (
                    <p className="text-xs text-amber-600 mt-2 p-2 bg-amber-50 rounded-lg">
                      Hinweis: {order.delivery_notes}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-white border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Zahlung</span>
                  </div>
                  <p className="font-medium text-gray-900">{paymentLabel}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={order.payment_status === 'paid' ? 'success' : 'secondary'}
                      className="text-xs"
                    >
                      {order.payment_status === 'paid' ? 'Bezahlt' : 'Ausstehend'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Artikel-Liste */}
              <div className="p-4 rounded-xl bg-white border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <Package className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Bestellte Artikel</span>
                </div>
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <span className="font-medium text-gray-900">{item.quantity}× {item.name}</span>
                      </div>
                      <span className="text-gray-600">
                        {formatCurrency(item.line_total_net, order.country)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between font-semibold">
                  <span>Gesamtsumme</span>
                  <span className="text-[#2D5016]">{formatCurrency(order.totals.total_gross, order.country)}</span>
                </div>
              </div>

              {/* Aktionen */}
              <div className="flex flex-wrap gap-3">
                <Link href={detailUrl} className="flex-1 min-w-[150px]">
                  <Button variant="outline" size="sm" className="w-full">
                    Details anzeigen
                  </Button>
                </Link>
                <a
                  href={`/api/orders/invoice?orderNo=${order.order_no}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[150px]"
                >
                  <Button variant="outline" size="sm" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Rechnung herunterladen
                  </Button>
                </a>

                {isCancelled && (
                  <Button variant="default" size="sm" className="flex-1 min-w-[150px] bg-[#FFB3C7] hover:bg-[#FF9AB3] text-black">
                    Rückerstattung über Klarna
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // Admin-Ansicht - kompakteres Tabellen-Layout
  return (
    <Card className={`overflow-hidden transition-all ${selected ? 'ring-2 ring-[#2D5016] bg-green-50/30' : 'hover:shadow-md'}`}>
      {/* Main row - improved grid layout */}
      <div className="grid grid-cols-[40px_120px_70px_1fr_100px_130px_90px_40px] gap-3 items-center p-4">
        {/* Checkbox for selection (admin only) */}
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(order.id, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[#2D5016] focus:ring-[#2D5016] cursor-pointer"
          />
        </div>

        {/* Order number & date */}
        <div>
          <Link href={detailUrl} className="font-mono text-sm font-semibold text-[#2D5016] hover:underline">
            {order.order_no}
          </Link>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.created_at)}</p>
        </div>

        {/* Country & type badges */}
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="text-xs justify-center">
            {order.country}
          </Badge>
          {order.order_type === 'preorder' && (
            <Badge variant="warning" className="text-xs justify-center">
              Vorb.
            </Badge>
          )}
        </div>

        {/* Product summary */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {itemSummary}
          </p>
          <p className="text-xs text-gray-500">
            {totalItems} {totalItems === 1 ? 'Artikel' : 'Artikel'}
          </p>
        </div>

        {/* Total */}
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">
            {formatCurrency(order.totals.total_gross, order.country)}
          </p>
          <p className="text-xs text-gray-500">
            inkl. {order.totals.vat_label}
          </p>
        </div>

        {/* Payment method & status */}
        <div>
          <p className="text-xs text-gray-600 truncate">{paymentLabel}</p>
          <Badge
            variant={order.payment_status === 'paid' ? 'success' : 'secondary'}
            className="text-xs mt-1"
          >
            {order.payment_status === 'paid' ? 'Bezahlt' : 'Ausstehend'}
          </Badge>
        </div>

        {/* Status */}
        <div>
          <StatusBadge status={order.status} />
        </div>

        {/* Expand button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(!expanded)}
          className="h-8 w-8"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Email badges row (admin only) */}
      {emailBadges.length > 0 && (
        <div className="px-4 pb-2 pl-[52px] flex gap-1">
          {emailBadges.map(badge => (
            <Badge key={badge} variant="info" className="text-xs">
              <Mail className="w-3 h-3 mr-1" />
              {badge}
            </Badge>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Address */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Lieferadresse
              </h4>
              <p className="text-sm font-medium text-gray-900">
                {order.customer_name}
              </p>
              <p className="text-sm text-gray-600">
                {formatAddressOneLine(order.delivery_address)}
              </p>
              {order.delivery_notes && (
                <p className="text-xs text-gray-500 mt-1 italic">
                  Hinweis: {order.delivery_notes}
                </p>
              )}
            </div>

            {/* Items */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Package className="w-3 h-3" />
                Artikel
              </h4>
              <ul className="space-y-1">
                {order.items.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-900 flex justify-between">
                    <span>{item.quantity}× {item.name}</span>
                    <span className="text-gray-500">
                      {formatCurrency(item.line_total_net, order.country)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm font-medium">
                <span>Gesamt</span>
                <span>{formatCurrency(order.totals.total_gross, order.country)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Link href={detailUrl}>
                <Button variant="outline" size="sm" className="w-full">
                  Details anzeigen
                </Button>
              </Link>

              <a
                href={`/api/orders/invoice?orderNo=${order.order_no}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full">
                  <FileText className="w-4 h-4 mr-2" />
                  Rechnung
                </Button>
              </a>

              {/* Admin actions */}
              {onAction && !isCancelled && (
                <div className="flex flex-col gap-2 mt-2">
                  {!order.email_flags.weekend_hello_sent && order.needs_weekend_hello && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => onAction('send_hello', order.id)}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Begrüßung senden
                    </Button>
                  )}
                  {!order.email_flags.confirmation_sent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => onAction('send_confirmation', order.id)}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Bestätigung senden
                    </Button>
                  )}
                  {order.status !== 'delivered' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => onAction('cancel', order.id)}
                    >
                      Bestellung stornieren
                    </Button>
                  )}
                </div>
              )}

              {/* Admin: Show cancelled state */}
              {isCancelled && (
                <div className="mt-2 p-2 bg-red-50 rounded text-center">
                  <p className="text-xs text-red-600 font-medium">Bestellung storniert</p>
                  <p className="text-xs text-red-500">Klarna-Rückerstattung im Kundenkonto verfügbar</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
