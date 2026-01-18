'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Filter,
  Search,
  RefreshCw,
  Mail,
  Send,
  XCircle,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { OrderCard } from '@/components/orders/order-card';
import { Order } from '@/types';

type ActionType = 'send_hello' | 'send_confirmation' | 'cancel' | null;

interface ActionDialog {
  type: ActionType;
  orderIds: string[];
  orderNos: string[];
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, preorders: 0, normal: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'normal' | 'preorder'>('normal');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  const userName = 'Admin';

  async function fetchOrders() {
    setLoading(true);
    try {
      const response = await fetch('/api/orders');
      const result = await response.json();
      if (result.success) {
        setOrders(result.data.orders);
        setMetrics(result.data.metrics);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const filteredOrders = orders.filter(o => o.order_type === activeTab);

  // Selection handlers
  const handleSelect = useCallback((orderId: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(orderId);
      } else {
        next.delete(orderId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  }, [filteredOrders, selectedIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Get selected order numbers for display
  const getSelectedOrderNos = useCallback((ids: string[]) => {
    return ids.map(id => {
      const order = orders.find(o => o.id === id);
      return order?.order_no || id;
    });
  }, [orders]);

  // Action handlers
  const handleAction = useCallback((action: string, orderId: string) => {
    const orderNos = getSelectedOrderNos([orderId]);
    setActionDialog({
      type: action as ActionType,
      orderIds: [orderId],
      orderNos,
    });
  }, [getSelectedOrderNos]);

  const handleBulkAction = useCallback((action: ActionType) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const orderNos = getSelectedOrderNos(ids);
    setActionDialog({
      type: action,
      orderIds: ids,
      orderNos,
    });
  }, [selectedIds, getSelectedOrderNos]);

  const confirmAction = async () => {
    if (!actionDialog) return;
    
    setActionLoading(true);
    try {
      // TODO: Implement actual API calls
      const response = await fetch('/api/orders/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionDialog.type,
          orderIds: actionDialog.orderIds,
        }),
      });
      
      if (response.ok) {
        // Refresh orders
        await fetchOrders();
        clearSelection();
      }
    } catch (error) {
      console.error('Action failed:', error);
    }
    setActionLoading(false);
    setActionDialog(null);
  };

  // Dialog content based on action type
  const getDialogContent = () => {
    if (!actionDialog) return { title: '', description: '', confirmLabel: '', variant: 'default' as const };
    
    const count = actionDialog.orderIds.length;
    const orderList = actionDialog.orderNos.join(', ');
    
    switch (actionDialog.type) {
      case 'send_hello':
        return {
          title: 'Send Hello Message',
          description: `Send welcome email to ${count} order${count > 1 ? 's' : ''}: ${orderList}`,
          confirmLabel: 'Send',
          variant: 'default' as const,
        };
      case 'send_confirmation':
        return {
          title: 'Send Confirmation',
          description: `Send order confirmation email to ${count} order${count > 1 ? 's' : ''}: ${orderList}`,
          confirmLabel: 'Send',
          variant: 'default' as const,
        };
      case 'cancel':
        return {
          title: 'Cancel Orders',
          description: `Are you sure you want to cancel ${count} order${count > 1 ? 's' : ''}? This action cannot be undone. Orders: ${orderList}`,
          confirmLabel: 'Cancel Orders',
          variant: 'destructive' as const,
        };
      default:
        return { title: '', description: '', confirmLabel: '', variant: 'default' as const };
    }
  };

  const dialogContent = getDialogContent();
  const hasSelection = selectedIds.size > 0;
  const allSelected = filteredOrders.length > 0 && selectedIds.size === filteredOrders.length;

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Header variant="admin" userName={userName} />

      <main className="container mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
            <p className="text-gray-600 mt-1">
              {orders.length} {orders.length === 1 ? 'order' : 'orders'} total
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Bulk Actions Bar */}
        {hasSelection && (
          <Card className="mb-4 border-[#2D5016] bg-green-50/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[#2D5016]">
                    {selectedIds.size} selected
                  </span>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleBulkAction('send_hello')}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Hello
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleBulkAction('send_confirmation')}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Confirmation
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleBulkAction('cancel')}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px] max-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by order number, email..."
                    className="pl-10"
                  />
                </div>
              </div>
              
              <select className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white">
                <option value="">All Statuses</option>
                <option value="received">Received</option>
                <option value="confirmed">Confirmed</option>
                <option value="planning_delivery">Planning</option>
                <option value="shipped">Shipped</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white">
                <option value="">All Countries</option>
                <option value="AT">Austria</option>
                <option value="DE">Germany</option>
              </select>

              <select className="h-10 rounded-md border border-gray-300 px-3 text-sm bg-white">
                <option value="">All Payment Methods</option>
                <option value="vorkasse">Bank Transfer</option>
                <option value="lastschrift">Direct Debit</option>
                <option value="paypal">PayPal</option>
                <option value="klarna">Klarna</option>
              </select>

              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button 
            onClick={() => { setActiveTab('normal'); clearSelection(); }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'normal' 
                ? 'text-[#2D5016] border-b-2 border-[#2D5016] -mb-[1px]' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Orders
            <Badge variant="default" className="ml-2">{metrics.normal}</Badge>
          </button>
          <button 
            onClick={() => { setActiveTab('preorder'); clearSelection(); }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'preorder' 
                ? 'text-[#2D5016] border-b-2 border-[#2D5016] -mb-[1px]' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Preorders
            <Badge variant="warning" className="ml-2">{metrics.preorders}</Badge>
          </button>
        </div>

        {/* Select All Header */}
        {filteredOrders.length > 0 && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-[#2D5016]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-gray-400">
              (Hold Shift + Click to select range)
            </span>
          </div>
        )}

        {/* Orders list */}
        <div className="space-y-3">
          {loading && orders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin" />
                <p>Loading orders...</p>
              </CardContent>
            </Card>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <p className="text-lg font-medium mb-2">No orders found</p>
                <p className="text-sm">
                  {activeTab === 'preorder' 
                    ? 'No preorders received yet.'
                    : 'No orders received yet.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                variant="admin"
                selected={selectedIds.has(order.id)}
                onSelect={handleSelect}
                onAction={handleAction}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing 1-{filteredOrders.length} of {filteredOrders.length} orders
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </main>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={actionDialog !== null}
        onClose={() => setActionDialog(null)}
        title={dialogContent.title}
        description={dialogContent.description}
        confirmLabel={dialogContent.confirmLabel}
        cancelLabel="Abbrechen"
        variant={dialogContent.variant}
        onConfirm={confirmAction}
        loading={actionLoading}
      />
    </div>
  );
}
