import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Order, 
  OrderItem, 
  OrderStatus, 
  PaymentStatus, 
  CreateOrderInput,
  PaginatedResponse,
  TotalsSnapshot,
  Address,
} from '@/types';
import { IOrderRepository, OrderFilters } from '../interfaces';
import { formatOrderNo, buildTotalsSnapshot, needsWeekendHello, generateId } from '@/lib/utils';
import { COUNTRY_CONFIG, ORDER_CONFIG } from '@/config';

export class SupabaseOrderRepository implements IOrderRepository {
  constructor(private supabase: SupabaseClient) {}

  private mapDbToOrder(row: any): Order {
    return {
      id: row.id,
      order_seq: row.order_seq,
      order_no: formatOrderNo(row.order_seq),
      user_id: row.user_id,
      email: row.email,
      phone: row.phone,
      customer_name: row.customer_name,
      company_name: row.company_name,
      country: row.country,
      order_type: row.order_type,
      status: row.status,
      payment_method: row.payment_method,
      payment_status: row.payment_status,
      items: row.order_items || [],
      totals: row.totals as TotalsSnapshot,
      delivery_address: row.delivery_address as Address,
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

  async findById(id: string): Promise<Order | null> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapDbToOrder(data);
  }

  async findByOrderNo(orderNo: string): Promise<Order | null> {
    // Convert display format to sequence
    const seq = parseInt(orderNo.replace('-', ''), 10);
    return this.findBySeq(seq);
  }

  async findBySeq(seq: number): Promise<Order | null> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_seq', seq)
      .single();

    if (error || !data) return null;
    return this.mapDbToOrder(data);
  }

  async list(options: {
    filters?: OrderFilters;
    page?: number;
    per_page?: number;
    sort_by?: 'created_at' | 'order_seq' | 'total_gross';
    sort_dir?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Order>> {
    const {
      filters = {},
      page = 1,
      per_page = 20,
      sort_by = 'created_at',
      sort_dir = 'desc',
    } = options;

    let query = this.supabase
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' });

    // Apply filters
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.order_type) query = query.eq('order_type', filters.order_type);
    if (filters.country) query = query.eq('country', filters.country);
    if (filters.payment_method) query = query.eq('payment_method', filters.payment_method);
    if (filters.payment_status) query = query.eq('payment_status', filters.payment_status);
    if (filters.user_id) query = query.eq('user_id', filters.user_id);
    if (filters.email) query = query.eq('email', filters.email);
    if (filters.date_from) query = query.gte('created_at', filters.date_from);
    if (filters.date_to) query = query.lte('created_at', filters.date_to);
    if (filters.has_invoice === true) query = query.not('invoice_url', 'is', null);
    if (filters.has_invoice === false) query = query.is('invoice_url', null);
    if (filters.needs_weekend_hello) query = query.eq('needs_weekend_hello', true);

    // Sorting
    const sortColumn = sort_by === 'total_gross' ? 'totals->total_gross' : sort_by;
    query = query.order(sortColumn, { ascending: sort_dir === 'asc' });

    // Pagination
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      items: (data || []).map(this.mapDbToOrder),
      total: count || 0,
      page,
      per_page,
      total_pages: Math.ceil((count || 0) / per_page),
    };
  }

  async listByUser(userId: string, options?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Order>> {
    return this.list({
      filters: { user_id: userId },
      ...options,
    });
  }

  async listByEmail(email: string, options?: { page?: number; per_page?: number }): Promise<PaginatedResponse<Order>> {
    return this.list({
      filters: { email },
      ...options,
    });
  }

  async create(input: CreateOrderInput, items: OrderItem[]): Promise<Order> {
    const countryConfig = COUNTRY_CONFIG[input.country];
    
    // Calculate totals
    const subtotalNet = items.reduce((sum, item) => sum + item.line_total_net, 0);
    const shippingNet = subtotalNet >= ORDER_CONFIG.free_shipping_threshold 
      ? 0 
      : input.country === 'DE' ? ORDER_CONFIG.shipping_cost_de : ORDER_CONFIG.shipping_cost_at;
    
    const totals = buildTotalsSnapshot(subtotalNet, shippingNet, 0, input.country);

    // Check if weekend hello needed
    const needsHello = needsWeekendHello(new Date().toISOString());

    // Create order
    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .insert({
        user_id: input.country, // Will be set if user is logged in
        email: input.email,
        phone: input.phone,
        customer_name: input.customer_name,
        company_name: input.company_name,
        country: input.country,
        order_type: input.order_type,
        status: 'received',
        payment_method: input.payment_method,
        payment_status: 'pending',
        totals,
        delivery_address: input.delivery_address,
        delivery_date: input.delivery_date,
        delivery_notes: input.delivery_notes,
        email_flags: {},
        needs_weekend_hello: needsHello,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const itemsToInsert = items.map(item => ({
      order_id: order.id,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_net: item.unit_price_net,
      line_total_net: item.line_total_net,
    }));

    const { data: insertedItems, error: itemsError } = await this.supabase
      .from('order_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) throw itemsError;

    // Create initial event
    await this.supabase.from('order_events').insert({
      order_id: order.id,
      actor_type: 'system',
      event_type: 'created',
      payload: { order_type: input.order_type, country: input.country },
    });

    return this.mapDbToOrder({ ...order, order_items: insertedItems });
  }

  async updateStatus(
    id: string, 
    status: OrderStatus, 
    actorUserId?: string, 
    actorType: 'admin' | 'ops' | 'system' = 'system'
  ): Promise<Order> {
    // Get current order for event logging
    const current = await this.findById(id);
    if (!current) throw new Error('Order not found');

    const { data, error } = await this.supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select('*, order_items(*)')
      .single();

    if (error) throw error;

    // Log event
    await this.supabase.from('order_events').insert({
      order_id: id,
      actor_user_id: actorUserId,
      actor_type: actorType,
      event_type: 'status_changed',
      payload: { from: current.status, to: status },
    });

    return this.mapDbToOrder(data);
  }

  async updatePaymentStatus(id: string, status: PaymentStatus, actorUserId?: string): Promise<Order> {
    const current = await this.findById(id);
    if (!current) throw new Error('Order not found');

    const { data, error } = await this.supabase
      .from('orders')
      .update({ payment_status: status })
      .eq('id', id)
      .select('*, order_items(*)')
      .single();

    if (error) throw error;

    await this.supabase.from('order_events').insert({
      order_id: id,
      actor_user_id: actorUserId,
      actor_type: actorUserId ? 'admin' : 'system',
      event_type: 'payment_status_changed',
      payload: { from: current.payment_status, to: status },
    });

    return this.mapDbToOrder(data);
  }

  async setDeliveryDate(id: string, date: string, window?: string, actorUserId?: string): Promise<Order> {
    const { data, error } = await this.supabase
      .from('orders')
      .update({ 
        delivery_date: date,
        delivery_window: window,
      })
      .eq('id', id)
      .select('*, order_items(*)')
      .single();

    if (error) throw error;

    await this.supabase.from('order_events').insert({
      order_id: id,
      actor_user_id: actorUserId,
      actor_type: actorUserId ? 'admin' : 'system',
      event_type: 'delivery_date_set',
      payload: { date, window },
    });

    return this.mapDbToOrder(data);
  }

  async setInvoiceUrl(id: string, url: string): Promise<Order> {
    const { data, error } = await this.supabase
      .from('orders')
      .update({ 
        invoice_url: url,
        invoice_generated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, order_items(*)')
      .single();

    if (error) throw error;

    await this.supabase.from('order_events').insert({
      order_id: id,
      actor_type: 'system',
      event_type: 'invoice_generated',
      payload: { url },
    });

    return this.mapDbToOrder(data);
  }

  async setEmailFlag(id: string, flag: keyof Order['email_flags'], value: boolean): Promise<Order> {
    // Get current flags
    const current = await this.findById(id);
    if (!current) throw new Error('Order not found');

    const updatedFlags = {
      ...current.email_flags,
      [flag]: value,
      [`${flag}_at`]: value ? new Date().toISOString() : undefined,
    };

    const { data, error } = await this.supabase
      .from('orders')
      .update({ email_flags: updatedFlags })
      .eq('id', id)
      .select('*, order_items(*)')
      .single();

    if (error) throw error;
    return this.mapDbToOrder(data);
  }

  async addInternalNote(id: string, note: string, actorUserId: string): Promise<Order> {
    const current = await this.findById(id);
    if (!current) throw new Error('Order not found');

    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${note}`;
    const updatedNotes = current.internal_notes 
      ? `${current.internal_notes}\n\n${newNote}`
      : newNote;

    const { data, error } = await this.supabase
      .from('orders')
      .update({ internal_notes: updatedNotes })
      .eq('id', id)
      .select('*, order_items(*)')
      .single();

    if (error) throw error;

    await this.supabase.from('order_events').insert({
      order_id: id,
      actor_user_id: actorUserId,
      actor_type: 'admin',
      event_type: 'note_added',
      payload: { note },
    });

    return this.mapDbToOrder(data);
  }

  async setNextStatusAt(id: string, timestamp: string | null): Promise<void> {
    const { error } = await this.supabase
      .from('orders')
      .update({ next_status_at: timestamp })
      .eq('id', id);

    if (error) throw error;
  }

  async findPendingStatusTransitions(): Promise<Order[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .not('next_status_at', 'is', null)
      .lte('next_status_at', now)
      .not('status', 'in', '("delivered","cancelled")');

    if (error) throw error;
    return (data || []).map(this.mapDbToOrder);
  }

  async findNeedingWeekendHello(): Promise<Order[]> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('needs_weekend_hello', true)
      .not('email_flags->weekend_hello_sent', 'eq', true);

    if (error) throw error;
    return (data || []).map(this.mapDbToOrder);
  }

  async countByFilters(filters: OrderFilters): Promise<number> {
    let query = this.supabase
      .from('orders')
      .select('id', { count: 'exact', head: true });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.order_type) query = query.eq('order_type', filters.order_type);
    if (filters.country) query = query.eq('country', filters.country);
    if (filters.payment_method) query = query.eq('payment_method', filters.payment_method);
    if (filters.date_from) query = query.gte('created_at', filters.date_from);
    if (filters.date_to) query = query.lte('created_at', filters.date_to);

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }
}

