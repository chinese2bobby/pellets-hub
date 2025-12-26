import { NextRequest, NextResponse } from 'next/server';
import { getOrderByOrderNo, getEventsByOrderId } from '@/lib/memory-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const { orderNo } = await params;
    
    const order = getOrderByOrderNo(orderNo);
    
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const events = getEventsByOrderId(order.id);

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

