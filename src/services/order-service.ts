import { 
  Order, 
  OrderItem, 
  OrderStatus, 
  PaymentStatus, 
  CreateOrderInput,
  EmailType,
  Product,
} from '@/types';
import { 
  IOrderRepository, 
  IOutboxRepository, 
  IEventRepository,
  IProductRepository,
} from '@/repositories/interfaces';
import { 
  buildTotalsSnapshot, 
  needsWeekendHello, 
  getRandomDelay,
  generateId,
} from '@/lib/utils';
import { STATUS_CONFIG, COUNTRY_CONFIG, ORDER_CONFIG } from '@/config';

// ============================================
// ORDER SERVICE
// Handles all order-related business logic
// ============================================

export class OrderService {
  constructor(
    private orderRepo: IOrderRepository,
    private outboxRepo: IOutboxRepository,
    private eventRepo: IEventRepository,
    private productRepo?: IProductRepository,
  ) {}

  // ==========================================
  // CREATE ORDER
  // ==========================================

  async createOrder(input: CreateOrderInput): Promise<Order> {
    // Validate products and build items
    const items: OrderItem[] = [];
    
    for (const itemInput of input.items) {
      // In production, fetch product from repo
      // For now, we'll use the input data
      const product = this.productRepo 
        ? await this.productRepo.findBySku(itemInput.sku)
        : null;
      
      if (!product) {
        throw new Error(`Product not found: ${itemInput.sku}`);
      }

      const unitPrice = input.country === 'DE' 
        ? product.price_net_de 
        : product.price_net_at;
      
      items.push({
        id: generateId(),
        order_id: '', // Will be set after order creation
        sku: product.sku,
        name: input.country === 'DE' ? product.name_de : product.name_at,
        quantity: itemInput.quantity,
        unit: product.unit,
        unit_price_net: unitPrice,
        line_total_net: unitPrice * itemInput.quantity,
      });
    }

    // Create order via repository
    const order = await this.orderRepo.create(input, items);

    // Schedule first status transition
    await this.scheduleNextTransition(order);

    // Queue confirmation email
    await this.queueEmail(order.id, 'confirmation', order.email, {
      order_no: order.order_no,
      customer_name: order.customer_name,
      items: order.items,
      totals: order.totals,
    });

    // Check if needs weekend hello
    if (order.needs_weekend_hello) {
      await this.queueEmail(order.id, 'weekend_hello', order.email, {
        order_no: order.order_no,
        customer_name: order.customer_name,
      });
    }

    return order;
  }

  // ==========================================
  // STATUS MANAGEMENT
  // ==========================================

  async updateStatus(
    orderId: string, 
    newStatus: OrderStatus, 
    actorUserId?: string,
    actorType: 'admin' | 'ops' | 'system' = 'system',
    reason?: string
  ): Promise<Order> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new Error('Order not found');

    const oldStatus = order.status;

    // Validate transition
    if (!this.isValidTransition(oldStatus, newStatus)) {
      throw new Error(`Invalid status transition: ${oldStatus} -> ${newStatus}`);
    }

    // Update status
    const updated = await this.orderRepo.updateStatus(orderId, newStatus, actorUserId, actorType);

    // Schedule next automatic transition (unless manually overridden or terminal)
    if (actorType !== 'system' || !['delivered', 'cancelled'].includes(newStatus)) {
      await this.scheduleNextTransition(updated);
    }

    // Queue status-specific emails
    await this.handleStatusChangeEmails(updated, oldStatus, newStatus);

    return updated;
  }

  async cancelOrder(orderId: string, actorUserId: string, reason?: string): Promise<Order> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (order.status === 'delivered') {
      throw new Error('Cannot cancel a delivered order');
    }

    // Update status to cancelled
    const updated = await this.orderRepo.updateStatus(orderId, 'cancelled', actorUserId, 'admin');

    // Clear any scheduled transitions
    await this.orderRepo.setNextStatusAt(orderId, null);

    // Log event with reason
    await this.eventRepo.logManualOverride(orderId, 'cancelled', actorUserId, { reason });

    // Queue cancellation email
    await this.queueEmail(orderId, 'cancelled', order.email, {
      order_no: order.order_no,
      customer_name: order.customer_name,
      reason,
    });

    // Set email flag
    await this.orderRepo.setEmailFlag(orderId, 'cancelled_sent', true);

    return updated;
  }

  async markPaid(orderId: string, actorUserId: string): Promise<Order> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new Error('Order not found');

    return this.orderRepo.updatePaymentStatus(orderId, 'paid', actorUserId);
  }

  async setDeliveryDate(orderId: string, date: string, window?: string, actorUserId?: string): Promise<Order> {
    return this.orderRepo.setDeliveryDate(orderId, date, window, actorUserId);
  }

  // ==========================================
  // STATUS AUTOMATION
  // ==========================================

  private isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      received: ['confirmed', 'cancelled'],
      confirmed: ['planning_delivery', 'cancelled'],
      planning_delivery: ['shipped', 'cancelled'],
      shipped: ['in_transit', 'cancelled'],
      in_transit: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  private getNextStatus(current: OrderStatus): OrderStatus | null {
    const sequence: OrderStatus[] = [
      'received',
      'confirmed', 
      'planning_delivery',
      'shipped',
      'in_transit',
      'delivered',
    ];

    const currentIndex = sequence.indexOf(current);
    if (currentIndex === -1 || currentIndex === sequence.length - 1) {
      return null;
    }

    return sequence[currentIndex + 1];
  }

  async scheduleNextTransition(order: Order): Promise<void> {
    if (['delivered', 'cancelled'].includes(order.status)) {
      return;
    }

    const nextStatus = this.getNextStatus(order.status);
    if (!nextStatus) return;

    // Get delay configuration
    const transitionKey = `${order.status}_to_${nextStatus}`.replace('_delivery', '');
    const delays = STATUS_CONFIG.transitions as unknown as Record<string, { min: number; max: number }>;
    const config = delays[transitionKey];

    if (!config) return;

    // Calculate delay with deterministic randomness based on order ID
    const delay = getRandomDelay(order.id, config.min, config.max);
    const nextAt = new Date(Date.now() + delay).toISOString();

    await this.orderRepo.setNextStatusAt(order.id, nextAt);
  }

  // ==========================================
  // EMAIL MANAGEMENT
  // ==========================================

  async queueEmail(
    orderId: string, 
    emailType: EmailType, 
    toEmail: string, 
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.outboxRepo.create({
      order_id: orderId,
      email_type: emailType,
      to_email: toEmail,
      payload,
    });
  }

  private async handleStatusChangeEmails(
    order: Order, 
    oldStatus: OrderStatus, 
    newStatus: OrderStatus
  ): Promise<void> {
    const emailMap: Partial<Record<OrderStatus, EmailType>> = {
      shipped: 'shipped',
      in_transit: 'in_transit',
      delivered: 'delivered',
    };

    const emailType = emailMap[newStatus];
    if (emailType) {
      await this.queueEmail(order.id, emailType, order.email, {
        order_no: order.order_no,
        customer_name: order.customer_name,
        status: newStatus,
      });

      // Set flag
      const flagKey = `${emailType}_sent` as keyof Order['email_flags'];
      await this.orderRepo.setEmailFlag(order.id, flagKey, true);
    }

    // Queue review request after delivery
    if (newStatus === 'delivered') {
      // Delay review request by 3 days
      setTimeout(async () => {
        await this.queueEmail(order.id, 'review_request', order.email, {
          order_no: order.order_no,
          customer_name: order.customer_name,
        });
      }, 3 * 24 * 60 * 60 * 1000);
    }
  }

  // ==========================================
  // EMAIL ACTIONS (Admin)
  // ==========================================

  async sendWeekendHello(orderId: string, actorUserId: string): Promise<void> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new Error('Order not found');

    await this.queueEmail(orderId, 'weekend_hello', order.email, {
      order_no: order.order_no,
      customer_name: order.customer_name,
    });

    await this.orderRepo.setEmailFlag(orderId, 'weekend_hello_sent', true);
    await this.eventRepo.logManualOverride(orderId, 'send_weekend_hello', actorUserId);
  }

  async sendPaymentInstructions(orderId: string, actorUserId: string): Promise<void> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new Error('Order not found');

    await this.queueEmail(orderId, 'payment_instructions', order.email, {
      order_no: order.order_no,
      customer_name: order.customer_name,
      payment_method: order.payment_method,
      totals: order.totals,
    });

    await this.orderRepo.setEmailFlag(orderId, 'payment_instructions_sent', true);
    await this.eventRepo.logManualOverride(orderId, 'send_payment_instructions', actorUserId);
  }

  async sendConfirmation(orderId: string, actorUserId: string): Promise<void> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new Error('Order not found');

    await this.queueEmail(orderId, 'confirmation', order.email, {
      order_no: order.order_no,
      customer_name: order.customer_name,
      items: order.items,
      totals: order.totals,
    });

    await this.orderRepo.setEmailFlag(orderId, 'confirmation_sent', true);
    await this.eventRepo.logManualOverride(orderId, 'send_confirmation', actorUserId);
  }

  // ==========================================
  // INVOICE
  // ==========================================

  async generateInvoice(orderId: string): Promise<string> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) throw new Error('Order not found');

    // TODO: Implement actual invoice generation with PDF
    // For now, return placeholder URL
    const invoiceUrl = `/api/invoices/${order.order_no}.pdf`;

    await this.orderRepo.setInvoiceUrl(orderId, invoiceUrl);

    return invoiceUrl;
  }

  // ==========================================
  // INTERNAL NOTES
  // ==========================================

  async addNote(orderId: string, note: string, actorUserId: string): Promise<Order> {
    return this.orderRepo.addInternalNote(orderId, note, actorUserId);
  }
}

