import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, getOrdersByType, getMetrics } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

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

