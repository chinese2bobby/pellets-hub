import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, getOrderByOrderNo, getOrderByInvoiceToken, updateOrder, insertEvent } from '@/lib/db';
import { generateInvoiceHTML, generateInvoiceNo } from '@/lib/invoice/generate-invoice';
import { OrderEvent } from '@/types';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getClientIP } from '@/lib/security';

// GET /api/orders/invoice?token=xxx (public) or ?orderId=xxx / ?orderNo=xxx (admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const orderId = searchParams.get('orderId');
    const orderNo = searchParams.get('orderNo');
    const format = searchParams.get('format') || 'html';

    const ip = getClientIP(request);
    let order;

    if (token) {
      const rateCheck = checkRateLimit(`invoice:token:${ip}`, { windowMs: 60000, maxRequests: 20 });
      if (!rateCheck.allowed) {
        return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
      }
      order = await getOrderByInvoiceToken(token);
      if (!order) {
        return NextResponse.json({ success: false, error: 'Invalid invoice link' }, { status: 404 });
      }
    } else {
      const user = await getSession();
      if (!user || user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      const rateCheck = checkRateLimit(`admin:invoice:${ip}`, { windowMs: 60000, maxRequests: 30 });
      if (!rateCheck.allowed) {
        return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
      }
      if (!orderId && !orderNo) {
        return NextResponse.json({ success: false, error: 'orderId or orderNo is required' }, { status: 400 });
      }
      order = orderId ? await getOrderById(orderId) : await getOrderByOrderNo(orderNo!);
    }

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
    const html = await generateInvoiceHTML({
      invoiceNo,
      order,
      generatedAt,
    });

    // Update order with invoice info if not already done
    if (!order.invoice_generated_at) {
      await updateOrder(order.id, {
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
      await insertEvent(event);
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
    // Admin auth check
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`admin:invoice:${ip}`, { windowMs: 60000, maxRequests: 20 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { orderId, sendEmail } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const invoiceNo = generateInvoiceNo(order);
    const generatedAt = new Date();

    // Generate HTML
    const html = await generateInvoiceHTML({
      invoiceNo,
      order,
      generatedAt,
    });

    // Update order
    await updateOrder(order.id, {
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
    await insertEvent(event);

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
