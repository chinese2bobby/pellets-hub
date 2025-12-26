import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, getOrdersByType, getMetrics } from '@/lib/memory-store';

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
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'normal' | 'preorder' | null
  
  let orders;
  if (type === 'normal' || type === 'preorder') {
    orders = getOrdersByType(type);
  } else {
    orders = getAllOrders();
  }
  
  const metrics = getMetrics();
  
  return NextResponse.json({
    success: true,
    data: {
      orders,
      metrics,
    }
  }, { headers: corsHeaders });
}

