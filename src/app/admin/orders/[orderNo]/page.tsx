'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Send,
  XCircle,
  FileText,
  MapPin,
  Package,
  CreditCard,
  Clock,
  User,
  Phone,
  Building,
  MailPlus
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/orders/status-badge';
import { EmailComposer } from '@/components/admin/email-composer';
import { Order, OrderEvent } from '@/types';
import { formatCurrency, formatDate, formatAddressOneLine } from '@/lib/utils';
import { PAYMENT_METHODS, STATUS_CONFIG } from '@/config';

type ActionType = 'send_hello' | 'send_confirmation' | 'cancel' | null;

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderNo = params.orderNo as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<ActionType>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailSentMessage, setEmailSentMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [orderNo]);

  async function fetchOrder() {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderNo}`);
      const result = await response.json();
      if (result.success) {
        setOrder(result.data.order);
        setEvents(result.data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch order:', error);
    }
    setLoading(false);
  }

  async function handleAction(action: ActionType) {
    if (!order || !action) return;
    
    setActionLoading(true);
    try {
      const response = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          orderIds: [order.id],
        }),
      });
      
      if (response.ok) {
        await fetchOrder();
      }
    } catch (error) {
      console.error('Action failed:', error);
    }
    setActionLoading(false);
    setActionDialog(null);
  }

  function handleEmailSent(result: { success: boolean; error?: string; message?: string }) {
    if (result.success) {
      setEmailSentMessage('✅ E-Mail erfolgreich gesendet!');
      fetchOrder(); // Refresh to update email flags
    } else {
      setEmailSentMessage(`❌ Fehler: ${result.error}`);
    }
    // Clear message after 5 seconds
    setTimeout(() => setEmailSentMessage(null), 5000);
  }

  const getDialogContent = () => {
    switch (actionDialog) {
      case 'send_hello':
        return {
          title: 'Send Hello Message',
          description: `Send welcome email to order ${orderNo}?`,
          confirmLabel: 'Send',
          variant: 'default' as const,
        };
      case 'send_confirmation':
        return {
          title: 'Send Confirmation',
          description: `Send order confirmation email to ${orderNo}?`,
          confirmLabel: 'Send',
          variant: 'default' as const,
        };
      case 'cancel':
        return {
          title: 'Cancel Order',
          description: `Are you sure you want to cancel order ${orderNo}? This action cannot be undone.`,
          confirmLabel: 'Cancel Order',
          variant: 'destructive' as const,
        };
      default:
        return { title: '', description: '', confirmLabel: '', variant: 'default' as const };
    }
  };

  const dialogContent = getDialogContent();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <Header variant="admin" userName="Admin" />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading order...</div>
          </div>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <Header variant="admin" userName="Admin" />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="text-gray-500 text-lg">Order not found</div>
            <Link href="/admin/orders">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const paymentLabel = PAYMENT_METHODS[order.payment_method]?.label || order.payment_method;
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Header variant="admin" userName="Admin" />

      <main className="container mx-auto px-4 py-8">
        {/* Back link & header */}
        <div className="mb-6">
          <Link 
            href="/admin/orders" 
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Orders
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-gray-900 font-mono">
                  {order.order_no}
                </h1>
                <StatusBadge status={order.status} />
                {order.order_type === 'preorder' && (
                  <Badge variant="warning">Preorder</Badge>
                )}
              </div>
              <p className="text-gray-600 mt-1">
                Created {formatDate(order.created_at)} • {order.country}
              </p>
            </div>

            {/* Actions */}
            {!isCancelled && (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setEmailComposerOpen(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <MailPlus className="w-4 h-4 mr-2" />
                  E-Mail senden
                </Button>
                {!order.email_flags.weekend_hello_sent && order.needs_weekend_hello && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActionDialog('send_hello')}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Hello
                  </Button>
                )}
                {!order.email_flags.confirmation_sent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActionDialog('send_confirmation')}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Confirmation
                  </Button>
                )}
                {order.status !== 'delivered' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setActionDialog('cancel')}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{order.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{order.email}</p>
                  </div>
                  {order.phone && (
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium flex items-center gap-1">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {order.phone}
                      </p>
                    </div>
                  )}
                  {order.company_name && (
                    <div>
                      <p className="text-sm text-gray-500">Company</p>
                      <p className="font-medium flex items-center gap-1">
                        <Building className="w-4 h-4 text-gray-400" />
                        {order.company_name}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Delivery Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-gray-600">{formatAddressOneLine(order.delivery_address)}</p>
                {order.delivery_notes && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> {order.delivery_notes}
                    </p>
                  </div>
                )}
                {order.delivery_date && (
                  <p className="text-sm text-gray-500 mt-2">
                    Requested delivery: {order.delivery_date}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.quantity} × {formatCurrency(item.unit_price_net, order.country)}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(item.line_total_net, order.country)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t mt-4 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal (net)</span>
                    <span>{formatCurrency(order.totals.subtotal_net, order.country)}</span>
                  </div>
                  {order.totals.shipping_net > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Shipping</span>
                      <span>{formatCurrency(order.totals.shipping_net, order.country)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{order.totals.vat_label} ({(order.totals.vat_rate * 100).toFixed(0)}%)</span>
                    <span>{formatCurrency(order.totals.vat_amount, order.country)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(order.totals.total_gross, order.country)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Event Log */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No events yet</p>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div key={event.id} className="flex gap-3 text-sm">
                        <div className="w-2 h-2 mt-2 rounded-full bg-[#2D5016]" />
                        <div>
                          <p className="font-medium">{event.event_type}</p>
                          <p className="text-gray-500">{formatDate(event.created_at)}</p>
                          {event.payload && Object.keys(event.payload).length > 0 && (
                            <pre className="text-xs text-gray-400 mt-1">
                              {JSON.stringify(event.payload, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Method</p>
                    <p className="font-medium">{paymentLabel}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge 
                      variant={order.payment_status === 'paid' ? 'success' : 'warning'}
                      className="mt-1"
                    >
                      {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Email Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Emails Sent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Hello Message</span>
                    <Badge variant={order.email_flags.weekend_hello_sent ? 'success' : 'secondary'}>
                      {order.email_flags.weekend_hello_sent ? 'Sent' : 'Not sent'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Confirmation</span>
                    <Badge variant={order.email_flags.confirmation_sent ? 'success' : 'secondary'}>
                      {order.email_flags.confirmation_sent ? 'Sent' : 'Not sent'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Payment Info</span>
                    <Badge variant={order.email_flags.payment_instructions_sent ? 'success' : 'secondary'}>
                      {order.email_flags.payment_instructions_sent ? 'Sent' : 'Not sent'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Invoice
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.invoice_url ? (
                  <a 
                    href={order.invoice_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="w-full">
                      <FileText className="w-4 h-4 mr-2" />
                      Download Invoice
                    </Button>
                  </a>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Invoice not generated yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Cancelled notice */}
            {isCancelled && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 text-center">
                  <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="font-medium text-red-700">Order Cancelled</p>
                  <p className="text-sm text-red-600 mt-1">
                    Klarna refund available in customer account
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Dialog */}
      <Dialog
        open={actionDialog !== null}
        onClose={() => setActionDialog(null)}
        title={dialogContent.title}
        description={dialogContent.description}
        confirmLabel={dialogContent.confirmLabel}
        cancelLabel="Cancel"
        variant={dialogContent.variant}
        onConfirm={() => handleAction(actionDialog)}
        loading={actionLoading}
      />

      {/* Email Composer Modal */}
      {order && (
        <EmailComposer
          order={order}
          isOpen={emailComposerOpen}
          onClose={() => setEmailComposerOpen(false)}
          onSend={handleEmailSent}
        />
      )}

      {/* Email sent notification */}
      {emailSentMessage && (
        <div className="fixed bottom-4 right-4 bg-white border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom">
          <p className="text-sm font-medium">{emailSentMessage}</p>
        </div>
      )}
    </div>
  );
}

