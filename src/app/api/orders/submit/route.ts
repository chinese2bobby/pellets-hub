import { NextRequest, NextResponse } from 'next/server';
import { 
  Country, 
  OrderType, 
  PaymentMethod, 
  OrderStatus,
  PaymentStatus,
  TotalsSnapshot,
  Order,
  OrderItem,
  EmailFlags,
  OrderEvent,
  EmailOutbox
} from '@/types';
import { COUNTRY_CONFIG } from '@/config';
import { 
  insertOrder, 
  insertEvent, 
  insertOutboxEntry, 
  getNextOrderSeq 
} from '@/lib/memory-store';

// CORS headers for cross-origin requests from pellets-de-1
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, replace with specific domain
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Product pricing data (matches pellets-de-1 pricing)
const PRODUCTS = {
  // Eco-Linie Palettenware
  'eco-975': { name: 'Eco-Linie Palettenware', kg: 975, pricePerKg: 0.2499 },
  'eco-1950': { name: 'Eco-Linie Palettenware', kg: 1950, pricePerKg: 0.2499 },
  'eco-2925': { name: 'Eco-Linie Palettenware', kg: 2925, pricePerKg: 0.2499 },
  // Premium-Linie Palettenware
  'premium-975': { name: 'Premium-Linie Palettenware', kg: 975, pricePerKg: 0.2799 },
  'premium-1950': { name: 'Premium-Linie Palettenware', kg: 1950, pricePerKg: 0.2799 },
  'premium-2925': { name: 'Premium-Linie Palettenware', kg: 2925, pricePerKg: 0.2799 },
  // Premium Lose (Silo)
  'premium-lose-3000': { name: 'Premium-Linie Lose', kg: 3000, pricePerKg: 0.2599 },
  'premium-lose-5000': { name: 'Premium-Linie Lose', kg: 5000, pricePerKg: 0.2599 },
  'premium-lose-6000': { name: 'Premium-Linie Lose', kg: 6000, pricePerKg: 0.2599 },
  // Dynamic products from vorbestellung.html
  'eco': { name: 'Eco-Linie Palettenware', kgPerPalette: 975, pricePerKg: 0.2499 },
  'premium': { name: 'Premium-Linie Palettenware', kgPerPalette: 975, pricePerKg: 0.2799 },
  'silo': { name: 'Premium-Linie Lose', pricePerKg: 0.2599 },
} as Record<string, any>;

// Preorder form input (from vorbestellung.html)
interface PreorderFormData {
  type: 'preorder';
  country: Country;
  product: 'eco' | 'premium' | 'silo';
  quantity?: number; // palettes
  quantityKg?: number; // kg for silo
  month: string;
  monthHalf: 'first' | 'second';
  plz: string;
  city: string;
  street: string;
  housenumber: string;
  deliveryNotes?: string;
  salutation?: string;
  company?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  payment: PaymentMethod;
  acceptTerms: boolean;
  acceptDelivery: boolean;
}

// Normal order form input (from bestellung.html)
interface OrderFormData {
  type: 'order';
  pelletType: string;
  quantity: string;
  customQuantity?: string;
  country: 'deutschland' | 'oesterreich';
  plz: string;
  ort: string;
  strasse: string;
  firma?: string;
  anrede: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  lieferdatum?: string;
  lieferzeit?: string;
  besonderheiten?: string;
  hinweise?: string;
  zahlungsart: PaymentMethod;
  datenschutz: boolean;
  agb: boolean;
  newsletter?: boolean;
}

type FormData = PreorderFormData | OrderFormData;

// Format order number: 300001 -> "300-001"
function formatOrderNo(seq: number): string {
  const prefix = Math.floor(seq / 1000);
  const suffix = String(seq % 1000).padStart(3, '0');
  return `${prefix}-${suffix}`;
}

// Check if order was created on weekend (Sat/Sun in Europe/Paris timezone)
function isWeekendOrder(): boolean {
  const now = new Date();
  // Convert to Europe/Paris timezone
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const day = parisTime.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

// Calculate totals
function calculateTotals(
  items: OrderItem[],
  country: Country
): TotalsSnapshot {
  const config = COUNTRY_CONFIG[country];
  
  const subtotalNet = items.reduce((sum, item) => sum + item.line_total_net, 0);
  const shippingNet = 0; // Free shipping
  const surchargesNet = 0;
  
  const totalNet = subtotalNet + shippingNet + surchargesNet;
  const vatAmount = Math.round(totalNet * config.vat_rate);
  const totalGross = totalNet + vatAmount;

  return {
    subtotal_net: subtotalNet,
    shipping_net: shippingNet,
    surcharges_net: surchargesNet,
    vat_rate: config.vat_rate,
    vat_label: config.vat_label,
    vat_amount: vatAmount,
    total_gross: totalGross,
  };
}

// Parse preorder form data
function parsePreorder(formData: PreorderFormData): {
  items: OrderItem[];
  deliveryAddress: any;
  customerName: string;
  deliveryDate?: string;
  deliveryNotes?: string;
} {
  const productInfo = PRODUCTS[formData.product];
  let kg: number;
  let quantity: number;
  
  if (formData.product === 'silo') {
    kg = formData.quantityKg || 3000;
    quantity = kg;
  } else {
    quantity = formData.quantity || 2;
    kg = quantity * 975;
  }
  
  const priceNet = Math.round(kg * productInfo.pricePerKg * 100); // Convert to cents
  
  const items: OrderItem[] = [{
    id: crypto.randomUUID(),
    order_id: '', // Will be set later
    sku: formData.product,
    name: productInfo.name,
    quantity: formData.product === 'silo' ? kg : quantity,
    unit: formData.product === 'silo' ? 'kg' : 'palette',
    unit_price_net: Math.round(productInfo.pricePerKg * (formData.product === 'silo' ? 100 : 975 * 100)),
    line_total_net: priceNet,
  }];

  // Parse month and half
  const monthMap: Record<string, string> = {
    'aug26': '2026-08',
    'sep26': '2026-09',
    'oct26': '2026-10',
    'nov26': '2026-11',
    'dec26': '2026-12',
  };
  
  const monthBase = monthMap[formData.month] || '2026-08';
  const deliveryDate = formData.monthHalf === 'first' 
    ? `${monthBase}-01` 
    : `${monthBase}-16`;

  return {
    items,
    deliveryAddress: {
      country: formData.country,
      street: formData.street,
      house_no: formData.housenumber,
      zip: formData.plz,
      city: formData.city,
      access_notes: formData.deliveryNotes,
      is_default: false,
    },
    customerName: `${formData.firstName} ${formData.lastName}`,
    deliveryDate,
    deliveryNotes: formData.deliveryNotes,
  };
}

// Parse normal order form data
function parseOrder(formData: OrderFormData): {
  items: OrderItem[];
  deliveryAddress: any;
  customerName: string;
  country: Country;
  deliveryDate?: string;
  deliveryNotes?: string;
} {
  const country: Country = formData.country === 'oesterreich' ? 'AT' : 'DE';
  
  // Parse product type
  const productKey = formData.pelletType as keyof typeof PRODUCTS;
  const productInfo = PRODUCTS[productKey] || PRODUCTS['eco-975'];
  
  // Parse quantity
  let qty = parseInt(formData.quantity) || 1;
  const kg = productInfo.kg || (qty * 975);
  const pricePerKg = productInfo.pricePerKg || 0.2499;
  const priceNet = Math.round(kg * pricePerKg * 100); // Convert to cents
  
  const items: OrderItem[] = [{
    id: crypto.randomUUID(),
    order_id: '',
    sku: formData.pelletType,
    name: productInfo.name || 'Holzpellets',
    quantity: qty,
    unit: formData.pelletType.includes('lose') ? 'silo' : 'palette',
    unit_price_net: Math.round(pricePerKg * 975 * 100),
    line_total_net: priceNet,
  }];

  // Combine delivery notes
  const notes = [formData.besonderheiten, formData.hinweise]
    .filter(Boolean)
    .join('\n');

  return {
    items,
    deliveryAddress: {
      country,
      street: formData.strasse,
      house_no: '',
      zip: formData.plz,
      city: formData.ort,
      access_notes: notes,
      is_default: false,
    },
    customerName: `${formData.vorname} ${formData.nachname}`,
    country,
    deliveryDate: formData.lieferdatum,
    deliveryNotes: notes,
  };
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Handle POST request - submit order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const formData = body as FormData;
    
    // Get next order sequence number
    const seq = getNextOrderSeq();
    const orderNo = formatOrderNo(seq);
    
    // Determine order type and parse data
    const isPreorder = 'type' in formData && formData.type === 'preorder' || 'month' in formData;
    const orderType: OrderType = isPreorder ? 'preorder' : 'normal';
    
    let items: OrderItem[];
    let deliveryAddress: any;
    let customerName: string;
    let country: Country;
    let deliveryDate: string | undefined;
    let deliveryNotes: string | undefined;
    let email: string;
    let phone: string | undefined;
    let companyName: string | undefined;
    let paymentMethod: PaymentMethod;
    
    if (isPreorder) {
      const preorderData = formData as PreorderFormData;
      const parsed = parsePreorder(preorderData);
      items = parsed.items;
      deliveryAddress = parsed.deliveryAddress;
      customerName = parsed.customerName;
      country = preorderData.country;
      deliveryDate = parsed.deliveryDate;
      deliveryNotes = parsed.deliveryNotes;
      email = preorderData.email;
      phone = preorderData.phone;
      companyName = preorderData.company;
      paymentMethod = preorderData.payment || 'vorkasse';
    } else {
      const orderData = formData as OrderFormData;
      const parsed = parseOrder(orderData);
      items = parsed.items;
      deliveryAddress = parsed.deliveryAddress;
      customerName = parsed.customerName;
      country = parsed.country;
      deliveryDate = parsed.deliveryDate;
      deliveryNotes = parsed.deliveryNotes;
      email = orderData.email;
      phone = orderData.telefon;
      companyName = orderData.firma;
      paymentMethod = orderData.zahlungsart;
    }
    
    // Generate order ID
    const orderId = crypto.randomUUID();
    
    // Update items with order_id
    items = items.map(item => ({ ...item, order_id: orderId }));
    
    // Calculate totals
    const totals = calculateTotals(items, country);
    
    // Initial email flags
    const emailFlags: EmailFlags = {
      weekend_hello_sent: false,
      confirmation_sent: false,
    };
    
    // Check if weekend order
    const needsWeekendHello = isWeekendOrder();
    
    // Create the order object
    const order: Order = {
      id: orderId,
      order_seq: seq,
      order_no: orderNo,
      user_id: undefined,
      email,
      phone,
      customer_name: customerName,
      company_name: companyName,
      country,
      order_type: orderType,
      status: 'received' as OrderStatus,
      payment_method: paymentMethod,
      payment_status: 'pending' as PaymentStatus,
      items,
      totals,
      delivery_address: deliveryAddress,
      delivery_date: deliveryDate,
      delivery_notes: deliveryNotes,
      email_flags: emailFlags,
      needs_weekend_hello: needsWeekendHello,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Insert order into memory store
    insertOrder(order);
    
    // Insert order event
    const event: OrderEvent = {
      id: crypto.randomUUID(),
      order_id: orderId,
      actor_type: 'system',
      event_type: 'created',
      payload: {
        source: isPreorder ? 'vorbestellung.html' : 'bestellung.html',
        order_type: orderType,
        country,
        total_gross: totals.total_gross,
      },
      created_at: new Date().toISOString(),
    };
    insertEvent(event);
    
    // Create email outbox entry for confirmation
    const outboxEntry: EmailOutbox = {
      id: crypto.randomUUID(),
      order_id: orderId,
      email_type: 'confirmation',
      to_email: email,
      payload: {
        order_no: orderNo,
        customer_name: customerName,
        items,
        totals,
        country,
      },
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    insertOutboxEntry(outboxEntry);
    
    console.log(`✅ Order created: ${orderNo} (${orderType}) for ${customerName}`);
    
    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        order_no: orderNo,
        order_type: orderType,
        status: 'received',
        total_gross: totals.total_gross,
        currency: 'EUR',
      },
      message: `${isPreorder ? 'Vorbestellung' : 'Bestellung'} erfolgreich erstellt.`
    }, { 
      status: 201, 
      headers: corsHeaders 
    });
    
  } catch (error) {
    console.error('Order submission error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}
