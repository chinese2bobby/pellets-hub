import { NextRequest, NextResponse } from 'next/server';
import { 
  getOrderById, 
  updateOrder, 
  insertEvent, 
  insertOutboxEntry,
  updateOutboxEntry,
} from '@/lib/memory-store';
import { OrderEvent, EmailOutbox, OrderStatus } from '@/types';
import { sendEmail } from '@/lib/email';

interface ActionRequest {
  action: 'send_hello' | 'send_confirmation' | 'cancel';
  orderIds: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ActionRequest = await request.json();
    const { action, orderIds } = body;

    if (!action || !orderIds || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    const results: { orderId: string; success: boolean; error?: string }[] = [];

    for (const orderId of orderIds) {
      const order = getOrderById(orderId);
      
      if (!order) {
        results.push({ orderId, success: false, error: 'Order not found' });
        continue;
      }

      try {
        switch (action) {
          case 'send_hello': {
            // Create email outbox entry
            const outboxId = crypto.randomUUID();
            const outbox: EmailOutbox = {
              id: outboxId,
              order_id: orderId,
              email_type: 'weekend_hello',
              to_email: order.email,
              payload: {
                order_no: order.order_no,
                customer_name: order.customer_name,
              },
              status: 'pending',
              created_at: new Date().toISOString(),
            };
            insertOutboxEntry(outbox);

            // Send email immediately via Resend
            const helloResult = await sendEmail('weekend_hello', order);
            
            if (helloResult.success) {
              updateOutboxEntry(outboxId, { status: 'sent', sent_at: new Date().toISOString() });
              
              // Update order email flags
              updateOrder(orderId, {
                email_flags: {
                  ...order.email_flags,
                  weekend_hello_sent: true,
                },
                needs_weekend_hello: false,
              });

              // Create event
              const helloEvent: OrderEvent = {
                id: crypto.randomUUID(),
                order_id: orderId,
                actor_type: 'admin',
                event_type: 'email_sent',
                payload: { email_type: 'weekend_hello', message_id: helloResult.messageId },
                created_at: new Date().toISOString(),
              };
              insertEvent(helloEvent);

              results.push({ orderId, success: true });
              console.log(`✅ Hello email sent to ${order.email} for order ${order.order_no}`);
            } else {
              updateOutboxEntry(outboxId, { status: 'failed', error_message: helloResult.error });
              results.push({ orderId, success: false, error: helloResult.error });
              console.log(`❌ Hello email failed for order ${order.order_no}: ${helloResult.error}`);
            }
            break;
          }

          case 'send_confirmation': {
            // Create email outbox entry
            const confirmOutboxId = crypto.randomUUID();
            const confirmOutbox: EmailOutbox = {
              id: confirmOutboxId,
              order_id: orderId,
              email_type: 'confirmation',
              to_email: order.email,
              payload: {
                order_no: order.order_no,
                customer_name: order.customer_name,
                items: order.items,
                totals: order.totals,
              },
              status: 'pending',
              created_at: new Date().toISOString(),
            };
            insertOutboxEntry(confirmOutbox);

            // Send email immediately via Resend
            const confirmResult = await sendEmail('confirmation', order);
            
            if (confirmResult.success) {
              updateOutboxEntry(confirmOutboxId, { status: 'sent', sent_at: new Date().toISOString() });
              
              // Update order email flags and status
              updateOrder(orderId, {
                email_flags: {
                  ...order.email_flags,
                  confirmation_sent: true,
                },
                status: 'confirmed' as OrderStatus,
              });

              // Create event
              const confirmEvent: OrderEvent = {
                id: crypto.randomUUID(),
                order_id: orderId,
                actor_type: 'admin',
                event_type: 'status_changed',
                payload: { 
                  from: order.status, 
                  to: 'confirmed',
                  email_type: 'confirmation',
                  message_id: confirmResult.messageId,
                },
                created_at: new Date().toISOString(),
              };
              insertEvent(confirmEvent);

              results.push({ orderId, success: true });
              console.log(`✅ Confirmation email sent to ${order.email} for order ${order.order_no}`);
            } else {
              updateOutboxEntry(confirmOutboxId, { status: 'failed', error_message: confirmResult.error });
              results.push({ orderId, success: false, error: confirmResult.error });
              console.log(`❌ Confirmation email failed for order ${order.order_no}: ${confirmResult.error}`);
            }
            break;
          }

          case 'cancel': {
            // Create cancellation email outbox entry
            const cancelOutboxId = crypto.randomUUID();
            const cancelOutbox: EmailOutbox = {
              id: cancelOutboxId,
              order_id: orderId,
              email_type: 'cancelled',
              to_email: order.email,
              payload: {
                order_no: order.order_no,
                customer_name: order.customer_name,
                totals: order.totals,
                refund_method: 'klarna',
              },
              status: 'pending',
              created_at: new Date().toISOString(),
            };
            insertOutboxEntry(cancelOutbox);

            // Send cancellation email via Resend
            const cancelResult = await sendEmail('cancelled', order);
            
            if (cancelResult.success) {
              updateOutboxEntry(cancelOutboxId, { status: 'sent', sent_at: new Date().toISOString() });
            } else {
              updateOutboxEntry(cancelOutboxId, { status: 'failed', error_message: cancelResult.error });
            }

            // Update order status regardless of email result
            updateOrder(orderId, {
              status: 'cancelled' as OrderStatus,
            });

            // Create event
            const cancelEvent: OrderEvent = {
              id: crypto.randomUUID(),
              order_id: orderId,
              actor_type: 'admin',
              event_type: 'cancelled',
              payload: { 
                from: order.status, 
                reason: 'Admin cancelled',
                email_sent: cancelResult.success,
              },
              created_at: new Date().toISOString(),
            };
            insertEvent(cancelEvent);

            results.push({ orderId, success: true });
            console.log(`✅ Order ${order.order_no} cancelled${cancelResult.success ? ' (email sent)' : ' (email failed)'}`);
            break;
          }

          default:
            results.push({ orderId, success: false, error: 'Unknown action' });
        }
      } catch (error) {
        results.push({ orderId, success: false, error: String(error) });
      }
    }

    const allSuccess = results.every(r => r.success);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: allSuccess,
      message: `${successCount}/${orderIds.length} orders processed`,
      results,
    });

  } catch (error) {
    console.error('Action error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

