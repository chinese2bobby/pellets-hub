// Database abstraction layer - uses Supabase
// This replaces memory-store.ts for production

import { Order, OrderEvent, EmailOutbox, OrderItem } from '@/types';
import { createAdminSupabaseClient } from './supabase/server';
import { formatOrderNo } from './utils';

// ============================================
// HELPER: Map DB row to Order type
// ============================================
function mapRowToOrder(row: any): Order {
  return {
    id: row.id,
    order_seq: row.order_seq,
    order_no: formatOrderNo(row.order_seq),
    user_id: row.user_id,
    email: row.email,
    phone: row.phone,
    customer_name: row.customer_name,
    company_name: row.company_name,
    salutation: row.salutation,
    vat_id: row.vat_id,
    country: row.country,
    order_type: row.order_type,
    status: row.status,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    items: (row.order_items || []).map((item: any) => ({
      id: item.id,
      order_id: item.order_id,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_net: item.unit_price_net,
      line_total_net: item.line_total_net,
    })),
    totals: row.totals,
    delivery_address: row.delivery_address,
    delivery_date: row.delivery_date,
    delivery_window: row.delivery_window,
    delivery_notes: row.delivery_notes,
    invoice_url: row.invoice_url,
    invoice_generated_at: row.invoice_generated_at,
    email_flags: row.email_flags || {},
    needs_weekend_hello: row.needs_weekend_hello,
    next_status_at: row.next_status_at,
    status_plan_version: row.status_plan_version,
    internal_notes: row.internal_notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============================================
// ORDERS
// ============================================

export async function insertOrder(order: Order): Promise<Order> {
  const supabase = await createAdminSupabaseClient();

  // Insert order (without items)
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .insert({
      id: order.id,
      user_id: order.user_id,
      email: order.email,
      phone: order.phone,
      customer_name: order.customer_name,
      company_name: order.company_name,
      salutation: order.salutation,
      vat_id: order.vat_id,
      country: order.country,
      order_type: order.order_type,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      totals: order.totals,
      delivery_address: order.delivery_address,
      delivery_date: order.delivery_date,
      delivery_window: order.delivery_window,
      delivery_notes: order.delivery_notes,
      email_flags: order.email_flags,
      needs_weekend_hello: order.needs_weekend_hello,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // Insert items
  if (order.items.length > 0) {
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(order.items.map(item => ({
        id: item.id,
        order_id: orderRow.id,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price_net: item.unit_price_net,
        line_total_net: item.line_total_net,
      })));

    if (itemsError) throw itemsError;
  }

  return {
    ...order,
    order_seq: orderRow.order_seq,
    order_no: formatOrderNo(orderRow.order_seq),
  };
}

export async function getOrders(): Promise<Order[]> {
  const supabase = await createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRowToOrder);
}

export async function getAllOrders(): Promise<Order[]> {
  return getOrders();
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  const supabase = await createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .single();

  if (error || !data) return undefined;
  return mapRowToOrder(data);
}

export async function getOrderByOrderNo(orderNo: string): Promise<Order | undefined> {
  const supabase = await createAdminSupabaseClient();
  const seq = parseInt(orderNo.replace('-', ''), 10);

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_seq', seq)
    .single();

  if (error || !data) return undefined;
  return mapRowToOrder(data);
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
  const supabase = await createAdminSupabaseClient();

  // Remove items from updates (they're in a separate table)
  const { items, order_no, order_seq, ...dbUpdates } = updates as any;

  const { data, error } = await supabase
    .from('orders')
    .update({
      ...dbUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, order_items(*)')
    .single();

  if (error) throw error;
  if (!data) return undefined;

  return mapRowToOrder(data);
}

export async function getOrdersByType(orderType: 'normal' | 'preorder'): Promise<Order[]> {
  const supabase = await createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_type', orderType)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRowToOrder);
}

export async function getOrdersByEmail(email: string): Promise<Order[]> {
  const supabase = await createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .ilike('email', email)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRowToOrder);
}

// ============================================
// ORDER SEQUENCE
// ============================================

export async function getNextOrderSeq(): Promise<number> {
  // Supabase handles this with SERIAL, we get it from inserted row
  // This function is no longer needed with Supabase
  throw new Error('getNextOrderSeq not needed with Supabase - order_seq is auto-generated');
}

// ============================================
// EVENTS
// ============================================

export async function insertEvent(event: OrderEvent): Promise<OrderEvent> {
  const supabase = await createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('order_events')
    .insert({
      id: event.id,
      order_id: event.order_id,
      actor_user_id: event.actor_user_id,
      actor_type: event.actor_type,
      event_type: event.event_type,
      payload: event.payload,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    ...event,
    created_at: data.created_at,
  };
}

export async function getEventsByOrderId(orderId: string): Promise<OrderEvent[]> {
  const supabase = await createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('order_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============================================
// EMAIL OUTBOX
// ============================================

export async function insertOutboxEntry(entry: EmailOutbox): Promise<EmailOutbox> {
  const supabase = await createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('email_outbox')
    .insert({
      id: entry.id,
      order_id: entry.order_id,
      email_type: entry.email_type,
      to_email: entry.to_email,
      payload: entry.payload,
      status: entry.status,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPendingEmails(): Promise<EmailOutbox[]> {
  const supabase = await createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('email_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateOutboxEntry(id: string, updates: Partial<EmailOutbox>): Promise<EmailOutbox | undefined> {
  const supabase = await createAdminSupabaseClient();

  const { data, error } = await supabase
    .from('email_outbox')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// METRICS
// ============================================

export async function getMetrics() {
  const supabase = await createAdminSupabaseClient();

  const { data: orders, error } = await supabase
    .from('orders')
    .select('order_type, totals');

  if (error) throw error;

  const orderList = orders || [];
  return {
    total: orderList.length,
    preorders: orderList.filter(o => o.order_type === 'preorder').length,
    normal: orderList.filter(o => o.order_type === 'normal').length,
    totalRevenue: orderList.reduce((sum, o) => sum + (o.totals?.total_gross || 0), 0),
  };
}
