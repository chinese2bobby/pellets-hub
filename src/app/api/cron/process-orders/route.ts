import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { SupabaseOrderRepository } from '@/repositories/supabase/order-repository';
import { SupabaseOutboxRepository, SupabaseEventRepository } from '@/repositories/supabase/outbox-repository';
import { StatusScheduler } from '@/services/status-scheduler';

// This route is called by a cron job (e.g., Vercel Cron)
// Runs every 15 minutes to process pending status transitions and emails

export async function GET(request: NextRequest) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createAdminSupabaseClient();
    
    // Initialize repositories
    const orderRepo = new SupabaseOrderRepository(supabase);
    const outboxRepo = new SupabaseOutboxRepository(supabase);
    const eventRepo = new SupabaseEventRepository(supabase);
    
    // Initialize scheduler
    const scheduler = new StatusScheduler(orderRepo, eventRepo, outboxRepo);
    
    // Run all scheduled tasks
    const results = await scheduler.runAll();
    
    console.log('[Cron] Status transitions processed:', results.transitions.processed);
    console.log('[Cron] Weekend hellos queued:', results.weekendHellos.processed);
    
    if (results.transitions.errors.length > 0) {
      console.error('[Cron] Transition errors:', results.transitions.errors);
    }
    
    if (results.weekendHellos.errors.length > 0) {
      console.error('[Cron] Weekend hello errors:', results.weekendHellos.errors);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        transitions: {
          processed: results.transitions.processed,
          errors: results.transitions.errors.length,
        },
        weekendHellos: {
          processed: results.weekendHellos.processed,
          errors: results.weekendHellos.errors.length,
        },
      },
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Allow POST as well for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

