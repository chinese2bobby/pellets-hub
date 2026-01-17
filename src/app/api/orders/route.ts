import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, getOrdersByType, getMetrics } from '@/lib/db';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
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
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch orders',
    }, { status: 500, headers: corsHeaders });
  }
}

