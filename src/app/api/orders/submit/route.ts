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
} from '@/lib/db';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

// Hash password for user creation
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Create user account during checkout
async function createUserAccount(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone?: string,
  companyName?: string,
  country?: Country
): Promise<string | null> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      // User already exists, return their ID
      return existing.id;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: 'customer',
      })
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return null;
    }

    // Create profile
    await supabase
      .from('customer_profiles')
      .insert({
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        company_name: companyName || null,
        default_country: country || 'DE',
      });

    console.log(`✅ User account created: ${email}`);
    return user.id;
  } catch (error) {
    console.error('User creation error:', error);
    return null;
  }
}

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
  type: 'preorder' | 'order';
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
  vatId?: string; // USt-IdNr / UID-Nummer for B2B
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password?: string; // For account creation during checkout
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
  ustIdNr?: string; // USt-IdNr / UID-Nummer for B2B
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
  password?: string; // For account creation during checkout
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

// Validate Austrian VAT ID format (ATU + 8 digits)
function isValidAtVatId(vatId: string | undefined): boolean {
  if (!vatId) return false;
  return /^ATU[0-9]{8}$/i.test(vatId.replace(/\s/g, ''));
}

// Validate German VAT ID format (DE + 9 digits)
function isValidDeVatId(vatId: string | undefined): boolean {
  if (!vatId) return false;
  return /^DE[0-9]{9}$/i.test(vatId.replace(/\s/g, ''));
}

// Calculate totals with B2B / Reverse Charge logic
// AT + B2B with valid UID = Reverse Charge (0% USt)
// AT + B2C = 20% USt
// DE (any) = 7% MwSt
function calculateTotals(
  items: OrderItem[],
  country: Country,
  companyName?: string,
  vatId?: string
): TotalsSnapshot {
  const config = COUNTRY_CONFIG[country];

  const subtotalNet = items.reduce((sum, item) => sum + item.line_total_net, 0);
  const shippingNet = 0; // Free shipping
  const surchargesNet = 0;
  const totalNet = subtotalNet + shippingNet + surchargesNet;

  // Check for B2B Reverse Charge (Austria only)
  const isB2B = Boolean(companyName && companyName.trim().length > 0);
  const hasValidAtVatId = country === 'AT' && isValidAtVatId(vatId);
  const isReverseCharge = country === 'AT' && isB2B && hasValidAtVatId;

  let vatRate: number;
  let vatLabel: string;
  let vatAmount: number;

  if (isReverseCharge) {
    // Austrian B2B with valid UID-Nummer = Reverse Charge
    vatRate = 0;
    vatLabel = 'Reverse Charge';
    vatAmount = 0;
  } else if (country === 'AT') {
    // Austrian B2C = 20% USt
    vatRate = 0.20;
    vatLabel = 'USt.';
    vatAmount = Math.round(totalNet * vatRate);
  } else {
    // Germany (B2B or B2C) = 7% MwSt for pellets
    vatRate = 0.07;
    vatLabel = 'MwSt.';
    vatAmount = Math.round(totalNet * vatRate);
  }

  const totalGross = totalNet + vatAmount;

  return {
    subtotal_net: subtotalNet,
    shipping_net: shippingNet,
    surcharges_net: surchargesNet,
    vat_rate: vatRate,
    vat_label: vatLabel,
    vat_amount: vatAmount,
    total_gross: totalGross,
    is_reverse_charge: isReverseCharge,
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
    let vatId: string | undefined;
    let paymentMethod: PaymentMethod;
    let salutation: 'herr' | 'frau' | 'firma' | 'divers' | undefined;
    let password: string | undefined;
    let firstName: string | undefined;
    let lastName: string | undefined;

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
      vatId = preorderData.vatId;
      paymentMethod = preorderData.payment || 'vorkasse';
      salutation = preorderData.salutation as typeof salutation;
      password = preorderData.password;
      firstName = preorderData.firstName;
      lastName = preorderData.lastName;
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
      vatId = orderData.ustIdNr;
      paymentMethod = orderData.zahlungsart;
      salutation = orderData.anrede as typeof salutation;
      password = orderData.password;
      firstName = orderData.vorname;
      lastName = orderData.nachname;
    }

    // Generate order ID
    const orderId = crypto.randomUUID();

    // Update items with order_id
    items = items.map(item => ({ ...item, order_id: orderId }));

    // Calculate totals with B2B / Reverse Charge logic
    const totals = calculateTotals(items, country, companyName, vatId);
    
    // Initial email flags
    const emailFlags: EmailFlags = {
      weekend_hello_sent: false,
      confirmation_sent: false,
    };
    
    // Check if weekend order
    const needsWeekendHello = isWeekendOrder();
    
    // Create the order object (order_seq and order_no will be set by Supabase)
    const orderData: Omit<Order, 'order_seq' | 'order_no'> & { order_seq?: number; order_no?: string } = {
      id: orderId,
      order_seq: undefined, // Will be auto-generated by Supabase
      order_no: undefined,  // Will be set from order_seq
      user_id: undefined,
      email,
      phone,
      customer_name: customerName,
      company_name: companyName,
      vat_id: vatId,
      salutation,
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
    
    // Insert order into database (returns order with order_seq and order_no from Supabase)
    const order = await insertOrder(orderData as Order);
    const orderNo = order.order_no!;

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
    await insertEvent(event);

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
    await insertOutboxEntry(outboxEntry);

    console.log(`✅ Order created: ${orderNo} (${orderType}) for ${customerName}`);

    // Create user account if password was provided
    let userId: string | null = null;
    if (password && firstName && lastName) {
      userId = await createUserAccount(
        email,
        password,
        firstName,
        lastName,
        phone,
        companyName,
        country
      );
    }

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
