import { Order, OrderStatus } from '@/types';
import { IOrderRepository, IEventRepository, IOutboxRepository } from '@/repositories/interfaces';
import { OrderService } from './order-service';

// ============================================
// STATUS SCHEDULER
// Handles automatic status transitions
// Called by cron job or scheduled task
// ============================================

export class StatusScheduler {
  private orderService: OrderService;

  constructor(
    private orderRepo: IOrderRepository,
    private eventRepo: IEventRepository,
    private outboxRepo: IOutboxRepository,
  ) {
    this.orderService = new OrderService(orderRepo, outboxRepo, eventRepo);
  }

  // ==========================================
  // PROCESS PENDING TRANSITIONS
  // ==========================================

  async processPendingTransitions(): Promise<{
    processed: number;
    errors: { orderId: string; error: string }[];
  }> {
    const pendingOrders = await this.orderRepo.findPendingStatusTransitions();
    const errors: { orderId: string; error: string }[] = [];
    let processed = 0;

    for (const order of pendingOrders) {
      try {
        await this.processOrderTransition(order);
        processed++;
      } catch (error) {
        errors.push({
          orderId: order.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { processed, errors };
  }

  private async processOrderTransition(order: Order): Promise<void> {
    const nextStatus = this.getNextStatus(order.status);
    
    if (!nextStatus) {
      // Clear next_status_at if no valid transition
      await this.orderRepo.setNextStatusAt(order.id, null);
      return;
    }

    // Perform the transition
    await this.orderService.updateStatus(
      order.id,
      nextStatus,
      undefined, // No actor - system
      'system'
    );

    console.log(`[StatusScheduler] Transitioned order ${order.order_no}: ${order.status} -> ${nextStatus}`);
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

  // ==========================================
  // PROCESS WEEKEND HELLO
  // ==========================================

  async processWeekendHellos(): Promise<{
    processed: number;
    errors: { orderId: string; error: string }[];
  }> {
    const orders = await this.orderRepo.findNeedingWeekendHello();
    const errors: { orderId: string; error: string }[] = [];
    let processed = 0;

    for (const order of orders) {
      try {
        // Queue email
        await this.outboxRepo.create({
          order_id: order.id,
          email_type: 'weekend_hello',
          to_email: order.email,
          payload: {
            order_no: order.order_no,
            customer_name: order.customer_name,
          },
        });

        // Set flag
        await this.orderRepo.setEmailFlag(order.id, 'weekend_hello_sent', true);

        // Log event
        await this.eventRepo.create({
          order_id: order.id,
          actor_type: 'system',
          event_type: 'email_sent',
          payload: { email_type: 'weekend_hello', auto: true },
        });

        processed++;
        console.log(`[StatusScheduler] Queued weekend hello for order ${order.order_no}`);
      } catch (error) {
        errors.push({
          orderId: order.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { processed, errors };
  }

  // ==========================================
  // RUN ALL SCHEDULED TASKS
  // ==========================================

  async runAll(): Promise<{
    transitions: { processed: number; errors: { orderId: string; error: string }[] };
    weekendHellos: { processed: number; errors: { orderId: string; error: string }[] };
  }> {
    const [transitions, weekendHellos] = await Promise.all([
      this.processPendingTransitions(),
      this.processWeekendHellos(),
    ]);

    return { transitions, weekendHellos };
  }
}

