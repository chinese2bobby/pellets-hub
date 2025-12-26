import { SupabaseClient } from '@supabase/supabase-js';
import { EmailOutbox, OrderEvent, OrderStatus, PaymentStatus } from '@/types';
import { IOutboxRepository, IEventRepository } from '../interfaces';

// ============================================
// EMAIL OUTBOX REPOSITORY
// ============================================

export class SupabaseOutboxRepository implements IOutboxRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<EmailOutbox | null> {
    const { data, error } = await this.supabase
      .from('email_outbox')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as EmailOutbox;
  }

  async findByOrderId(orderId: string): Promise<EmailOutbox[]> {
    const { data, error } = await this.supabase
      .from('email_outbox')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as EmailOutbox[];
  }

  async findPending(limit: number = 50): Promise<EmailOutbox[]> {
    const { data, error } = await this.supabase
      .from('email_outbox')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []) as EmailOutbox[];
  }

  async findFailed(limit: number = 50): Promise<EmailOutbox[]> {
    const { data, error } = await this.supabase
      .from('email_outbox')
      .select('*')
      .eq('status', 'failed')
      .lt('attempts', 3) // Only retry up to 3 times
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []) as EmailOutbox[];
  }

  async create(data: Omit<EmailOutbox, 'id' | 'created_at' | 'sent_at' | 'status' | 'attempts'>): Promise<EmailOutbox> {
    const { data: outbox, error } = await this.supabase
      .from('email_outbox')
      .insert({
        ...data,
        status: 'pending',
        attempts: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return outbox as EmailOutbox;
  }

  async markSent(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('email_outbox')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .from('email_outbox')
      .update({ 
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', id);

    if (error) throw error;
  }

  async incrementAttempts(id: string): Promise<void> {
    const { error } = await this.supabase
      .rpc('increment_outbox_attempts', { outbox_id: id });

    // Fallback if RPC doesn't exist
    if (error) {
      const { data: current } = await this.supabase
        .from('email_outbox')
        .select('attempts')
        .eq('id', id)
        .single();

      if (current) {
        await this.supabase
          .from('email_outbox')
          .update({ attempts: (current.attempts || 0) + 1 })
          .eq('id', id);
      }
    }
  }

  async createBatch(items: Omit<EmailOutbox, 'id' | 'created_at' | 'sent_at' | 'status' | 'attempts'>[]): Promise<EmailOutbox[]> {
    const toInsert = items.map(item => ({
      ...item,
      status: 'pending' as const,
      attempts: 0,
    }));

    const { data, error } = await this.supabase
      .from('email_outbox')
      .insert(toInsert)
      .select();

    if (error) throw error;
    return (data || []) as EmailOutbox[];
  }
}

// ============================================
// EVENT REPOSITORY
// ============================================

export class SupabaseEventRepository implements IEventRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByOrderId(orderId: string, options?: { limit?: number }): Promise<OrderEvent[]> {
    let query = this.supabase
      .from('order_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as OrderEvent[];
  }

  async create(event: Omit<OrderEvent, 'id' | 'created_at'>): Promise<OrderEvent> {
    const { data, error } = await this.supabase
      .from('order_events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data as OrderEvent;
  }

  async logStatusChange(
    orderId: string, 
    fromStatus: OrderStatus, 
    toStatus: OrderStatus, 
    actorUserId?: string, 
    actorType: 'admin' | 'ops' | 'system' = 'system'
  ): Promise<OrderEvent> {
    return this.create({
      order_id: orderId,
      actor_user_id: actorUserId,
      actor_type: actorType,
      event_type: 'status_changed',
      payload: { from: fromStatus, to: toStatus },
    });
  }

  async logPaymentChange(
    orderId: string, 
    fromStatus: PaymentStatus, 
    toStatus: PaymentStatus, 
    actorUserId?: string
  ): Promise<OrderEvent> {
    return this.create({
      order_id: orderId,
      actor_user_id: actorUserId,
      actor_type: actorUserId ? 'admin' : 'system',
      event_type: 'payment_status_changed',
      payload: { from: fromStatus, to: toStatus },
    });
  }

  async logEmailSent(orderId: string, emailType: string): Promise<OrderEvent> {
    return this.create({
      order_id: orderId,
      actor_type: 'system',
      event_type: 'email_sent',
      payload: { email_type: emailType },
    });
  }

  async logManualOverride(
    orderId: string, 
    action: string, 
    actorUserId: string, 
    details?: Record<string, unknown>
  ): Promise<OrderEvent> {
    return this.create({
      order_id: orderId,
      actor_user_id: actorUserId,
      actor_type: 'admin',
      event_type: 'manual_override',
      payload: { action, ...details },
    });
  }
}

