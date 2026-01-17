import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getOrdersByEmail } from '@/lib/db';

export async function GET() {
  try {
    const user = await getSession();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const orders = await getOrdersByEmail(user.email);

    return NextResponse.json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}















