import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  // Get all orders with totals
  const { data: orders, error } = await supabase
    .from('orders')
    .select('order_seq, customer_name, company_name, vat_id, country, order_type, status, payment_method, totals, created_at')
    .order('order_seq', { ascending: true });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('=== ORDERS IN DATABASE ===');
  console.log('Total orders:', orders?.length || 0);
  console.log('');

  for (const o of orders || []) {
    const orderNo = '300-' + String(o.order_seq).slice(3).padStart(3, '0');
    const name = (o.customer_name || '').padEnd(18);
    const company = o.company_name ? ' [' + o.company_name + ']' : '';
    const vatId = o.vat_id ? ' UID:' + o.vat_id : '';
    const totals = o.totals as any;
    const vatInfo = totals.is_reverse_charge ? 'RC' : totals.vat_rate * 100 + '%';
    const gross = (totals.total_gross / 100).toFixed(2);

    console.log(orderNo + ' | ' + name + ' | ' + o.country + ' | ' + o.order_type.padEnd(8) + ' | ' + o.payment_method.padEnd(10) + ' | ' + vatInfo.padEnd(4) + ' | ' + gross + ' EUR' + company + vatId);
  }

  // Check order_items
  const { data: items } = await supabase
    .from('order_items')
    .select('order_id, sku, name, quantity, unit');

  console.log('');
  console.log('=== ORDER ITEMS ===');
  console.log('Total items:', items?.length || 0);

  // Check order_events
  const { data: events } = await supabase
    .from('order_events')
    .select('order_id, event_type')
    .limit(20);

  console.log('');
  console.log('=== ORDER EVENTS ===');
  console.log('Total events:', events?.length || 0);

  // Check email_outbox
  const { data: emails } = await supabase
    .from('email_outbox')
    .select('order_id, email_type, status');

  console.log('');
  console.log('=== EMAIL OUTBOX ===');
  console.log('Total emails:', emails?.length || 0);
  for (const e of emails || []) {
    console.log('  ' + e.email_type + ' - ' + e.status);
  }
}

check();
