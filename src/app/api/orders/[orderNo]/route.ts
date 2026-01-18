import { NextRequest, NextResponse } from 'next/server';
import { getOrderByOrderNo, getEventsByOrderId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getClientIP } from '@/lib/security';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
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
    const rateCheck = checkRateLimit(`admin:order-detail:${ip}`, { windowMs: 60000, maxRequests: 60 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const { orderNo } = await params;

    const order = await getOrderByOrderNo(orderNo);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const events = await getEventsByOrderId(order.id);

    return NextResponse.json({
      success: true,
      data: {
        order,
        events,
      },
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

