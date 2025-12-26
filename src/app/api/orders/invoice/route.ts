import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, getOrderByOrderNo, updateOrder, insertEvent } from '@/lib/memory-store';
import { generateInvoiceHTML, generateInvoiceNo } from '@/lib/invoice/generate-invoice';
import { OrderEvent } from '@/types';

// GET /api/orders/invoice?orderId=xxx or ?orderNo=xxx
// Returns invoice HTML or triggers PDF download
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const orderNo = searchParams.get('orderNo');
    const format = searchParams.get('format') || 'html'; // 'html' or 'pdf'

    if (!orderId && !orderNo) {
      return NextResponse.json(
        { success: false, error: 'orderId or orderNo is required' },
        { status: 400 }
      );
    }

    // Find order
    const order = orderId
      ? getOrderById(orderId)
      : getOrderByOrderNo(orderNo!);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Generate invoice number if not already set
    const invoiceNo = generateInvoiceNo(order);
    const generatedAt = new Date();

    // Generate HTML
    const html = generateInvoiceHTML({
      invoiceNo,
      order,
      generatedAt,
    });

    // Update order with invoice info if not already done
    if (!order.invoice_generated_at) {
      updateOrder(order.id, {
        invoice_url: `/api/orders/invoice?orderId=${order.id}&format=html`,
        invoice_generated_at: generatedAt.toISOString(),
      });

      // Create event
      const event: OrderEvent = {
        id: crypto.randomUUID(),
        order_id: order.id,
        actor_type: 'admin',
        event_type: 'invoice_generated',
        payload: {
          invoice_no: invoiceNo,
          format,
        },
        created_at: generatedAt.toISOString(),
      };
      insertEvent(event);
    }

    if (format === 'pdf') {
      // For PDF, we'd need puppeteer or similar
      // For now, return HTML with print-friendly headers
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="Rechnung-${invoiceNo}.html"`,
        },
      });
    }

    // Return HTML
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Invoice generation error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/orders/invoice - Generate and optionally send invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, sendEmail } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    const order = getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const invoiceNo = generateInvoiceNo(order);
    const generatedAt = new Date();

    // Generate HTML
    const html = generateInvoiceHTML({
      invoiceNo,
      order,
      generatedAt,
    });

    // Update order
    updateOrder(order.id, {
      invoice_url: `/api/orders/invoice?orderId=${order.id}&format=html`,
      invoice_generated_at: generatedAt.toISOString(),
    });

    // Create event
    const event: OrderEvent = {
      id: crypto.randomUUID(),
      order_id: order.id,
      actor_type: 'admin',
      event_type: 'invoice_generated',
      payload: {
        invoice_no: invoiceNo,
        send_email: sendEmail,
      },
      created_at: generatedAt.toISOString(),
    };
    insertEvent(event);

    // If sendEmail is true, also send the invoice via email
    if (sendEmail) {
      // This would call the send-email API with invoice template
      // For now, just log
      console.log(`📧 Would send invoice ${invoiceNo} to ${order.email}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        invoiceNo,
        invoiceUrl: `/api/orders/invoice?orderId=${order.id}&format=html`,
        generatedAt: generatedAt.toISOString(),
      },
      message: `Rechnung ${invoiceNo} erstellt`,
    });

  } catch (error) {
    console.error('Invoice generation error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
