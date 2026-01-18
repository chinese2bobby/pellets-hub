// In-memory store with file persistence for development
// Survives hot reload by saving to disk

import { Order, OrderEvent, EmailOutbox } from '@/types';
import * as fs from 'fs';
import * as path from 'path';

interface MemoryStore {
  orders: Order[];
  events: OrderEvent[];
  outbox: EmailOutbox[];
  orderSeq: number;
}

// File path for persistence
const STORE_FILE = path.join(process.cwd(), '.store-data.json');

// Load store from file or create empty
function loadStore(): MemoryStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      console.log(`📦 Loaded ${parsed.orders?.length || 0} orders from disk`);
      return parsed;
    }
  } catch (e) {
    console.log('⚠️ Could not load store, starting fresh');
  }
  return {
    orders: [],
    events: [],
    outbox: [],
    orderSeq: 300001,
  };
}

// Save store to file
function saveStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('❌ Could not save store:', e);
  }
}

// Initialize store from file
const store: MemoryStore = loadStore();

// Seed test data if empty
if (store.orders.length === 0) {
  seedTestData();
  saveStore();
}

// Orders
export function insertOrder(order: Order): Order {
  store.orders.push(order);
  saveStore();
  return order;
}

export function getOrders(): Order[] {
  return store.orders;
}

export function getOrderById(id: string): Order | undefined {
  return store.orders.find(o => o.id === id);
}

export function getOrderByOrderNo(orderNo: string): Order | undefined {
  return store.orders.find(o => o.order_no === orderNo);
}

export function updateOrder(id: string, updates: Partial<Order>): Order | undefined {
  const index = store.orders.findIndex(o => o.id === id);
  if (index === -1) return undefined;

  store.orders[index] = {
    ...store.orders[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  saveStore();
  return store.orders[index];
}

// Order sequence
export function getNextOrderSeq(): number {
  const seq = store.orderSeq++;
  saveStore();
  return seq;
}

// Events
export function insertEvent(event: OrderEvent): OrderEvent {
  store.events.push(event);
  saveStore();
  return event;
}

export function getEventsByOrderId(orderId: string): OrderEvent[] {
  return store.events.filter(e => e.order_id === orderId);
}

// Email Outbox
export function insertOutboxEntry(entry: EmailOutbox): EmailOutbox {
  store.outbox.push(entry);
  saveStore();
  return entry;
}

export function getPendingEmails(): EmailOutbox[] {
  return store.outbox.filter(e => e.status === 'pending');
}

export function updateOutboxEntry(id: string, updates: Partial<EmailOutbox>): EmailOutbox | undefined {
  const index = store.outbox.findIndex(e => e.id === id);
  if (index === -1) return undefined;

  store.outbox[index] = { ...store.outbox[index], ...updates };
  saveStore();
  return store.outbox[index];
}

// Get all orders for admin panel
export function getAllOrders(): Order[] {
  return [...store.orders].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// Get orders by type
export function getOrdersByType(orderType: 'normal' | 'preorder'): Order[] {
  return store.orders.filter(o => o.order_type === orderType);
}

// Get orders by email (for customer portal)
export function getOrdersByEmail(email: string): Order[] {
  return store.orders
    .filter(o => o.email.toLowerCase() === email.toLowerCase())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// Simple metrics
export function getMetrics() {
  const orders = store.orders;
  return {
    total: orders.length,
    preorders: orders.filter(o => o.order_type === 'preorder').length,
    normal: orders.filter(o => o.order_type === 'normal').length,
    totalRevenue: orders.reduce((sum, o) => sum + (o.totals?.total_gross || 0), 0),
  };
}

// Seed test data
export function seedTestData() {
  if (store.orders.length > 0) return;

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Test order 1 - AT B2C (20% USt)
  const order1: Order = {
    id: 'test-order-001',
    order_seq: 300001,
    order_no: '300-001',
    email: 'kevin@mastermind.io',
    phone: '+43 660 1234567',
    customer_name: 'Kevin Hall',
    country: 'AT',
    order_type: 'normal',
    status: 'confirmed',
    payment_method: 'vorkasse',
    payment_status: 'pending',
    items: [{
      id: 'item-001',
      order_id: 'test-order-001',
      sku: 'PREM-SACK',
      name: 'Premium-Linie Palettenware',
      quantity: 3,
      unit: 'palette',
      unit_price_net: 25900,
      line_total_net: 77700,
    }],
    totals: {
      subtotal_net: 77700,
      shipping_net: 0,
      surcharges_net: 0,
      vat_rate: 0.20,
      vat_label: 'USt.',
      vat_amount: 15540,
      total_gross: 93240,
    },
    delivery_address: {
      country: 'AT',
      street: 'Masterstraße',
      house_no: '42',
      zip: '1010',
      city: 'Wien',
    },
    delivery_notes: 'Lieferung hinten rum, Tor Code: 1234',
    email_flags: {
      weekend_hello_sent: false,
      confirmation_sent: true,
    },
    needs_weekend_hello: false,
    created_at: lastWeek.toISOString(),
    updated_at: yesterday.toISOString(),
  };

  // Test order 2 - AT B2B Reverse Charge (0% USt)
  const order2: Order = {
    id: 'test-order-002',
    order_seq: 300002,
    order_no: '300-002',
    email: 'buchhaltung@firma.at',
    phone: '+43 1 12345678',
    customer_name: 'Hans Geschäftsführer',
    company_name: 'Musterfirma GmbH',
    vat_id: 'ATU12345678',
    country: 'AT',
    order_type: 'preorder',
    status: 'planning_delivery',
    payment_method: 'vorkasse',
    payment_status: 'paid',
    items: [{
      id: 'item-002',
      order_id: 'test-order-002',
      sku: 'ECO-PAL',
      name: 'Eco-Linie Palettenware',
      quantity: 5,
      unit: 'palette',
      unit_price_net: 24400,
      line_total_net: 122000,
    }],
    totals: {
      subtotal_net: 122000,
      shipping_net: 0,
      surcharges_net: 0,
      vat_rate: 0,
      vat_label: 'Reverse Charge',
      vat_amount: 0,
      total_gross: 122000,
      is_reverse_charge: true,
    },
    delivery_address: {
      country: 'AT',
      street: 'Industriestraße',
      house_no: '100',
      zip: '1230',
      city: 'Wien',
    },
    delivery_date: '2026-09-01',
    email_flags: {
      weekend_hello_sent: false,
      confirmation_sent: true,
      payment_instructions_sent: true,
    },
    needs_weekend_hello: false,
    created_at: yesterday.toISOString(),
    updated_at: now.toISOString(),
  };

  // Test order 3 - DE (7% MwSt)
  const order3: Order = {
    id: 'test-order-003',
    order_seq: 300003,
    order_no: '300-003',
    email: 'test@example.de',
    phone: '+49 170 9876543',
    customer_name: 'Max Mustermann',
    country: 'DE',
    order_type: 'normal',
    status: 'received',
    payment_method: 'paypal',
    payment_status: 'pending',
    items: [{
      id: 'item-003',
      order_id: 'test-order-003',
      sku: 'PREM-LOSE',
      name: 'Premium-Linie Lose',
      quantity: 5000,
      unit: 'silo',
      unit_price_net: 26,
      line_total_net: 130000,
    }],
    totals: {
      subtotal_net: 130000,
      shipping_net: 0,
      surcharges_net: 0,
      vat_rate: 0.07,
      vat_label: 'MwSt.',
      vat_amount: 9100,
      total_gross: 139100,
    },
    delivery_address: {
      country: 'DE',
      street: 'Hauptstraße',
      house_no: '1',
      zip: '10115',
      city: 'Berlin',
    },
    email_flags: {},
    needs_weekend_hello: true,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  store.orders.push(order1, order2, order3);
  store.orderSeq = 300004;

  // Add events
  store.events.push({
    id: 'event-001',
    order_id: 'test-order-001',
    actor_type: 'system',
    event_type: 'created',
    payload: { source: 'bestellung.html' },
    created_at: lastWeek.toISOString(),
  });
  store.events.push({
    id: 'event-002',
    order_id: 'test-order-001',
    actor_type: 'admin',
    event_type: 'status_changed',
    payload: { from: 'received', to: 'confirmed' },
    created_at: yesterday.toISOString(),
  });

  console.log('🧠 Test data seeded with 3 orders (AT B2C, AT B2B Reverse Charge, DE)');
}

// Clear store (for testing)
export function clearStore() {
  store.orders = [];
  store.events = [];
  store.outbox = [];
  store.orderSeq = 300001;
  saveStore();
}
