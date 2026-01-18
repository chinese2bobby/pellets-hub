import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, getOrdersByType, getMetrics } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // Admin auth check
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting for admin endpoints
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`admin:orders:${ip}`, { windowMs: 60000, maxRequests: 60 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'normal' | 'preorder' | null

    let orders;
    if (type === 'normal' || type === 'preorder') {
      orders = await getOrdersByType(type);
    } else {
      orders = await getAllOrders();
    }

    const metrics = await getMetrics();

    return NextResponse.json({
      success: true,
      data: {
        orders,
        metrics,
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch orders',
    }, { status: 500 });
  }
}

