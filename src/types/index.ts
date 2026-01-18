// ============================================
// CORE DOMAIN TYPES - Pellets Hub
// ============================================

// Country codes
export type Country = 'DE' | 'AT';

// Salutation for proper addressing
export type Salutation = 'herr' | 'frau' | 'firma' | 'divers';

// User roles
export type UserRole = 'customer' | 'admin' | 'ops';

// Order types
export type OrderType = 'normal' | 'preorder';

// Order status - state machine
export type OrderStatus = 
  | 'received'
  | 'confirmed'
  | 'planning_delivery'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

// Payment methods
export type PaymentMethod =
  | 'vorkasse'      // Bank transfer prepayment
  | 'rechnung'      // Invoice (50% deposit required)
  | 'lastschrift'   // Direct debit
  | 'paypal'
  | 'klarna';

// Payment status
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

// Product units
export type ProductUnit = 'palette' | 'kg' | 'silo';

// Product types
export type ProductType = 'premium_lose' | 'premium_sack' | 'eco_palette';

// ============================================
// USER & AUTH
// ============================================

export interface User {
  id: string;
  email: string;
  password_hash?: string; // Phase 1 only
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface CustomerProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company_name?: string;
  vat_id?: string;
  default_country?: Country;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  country: Country;
  street: string;
  house_no: string;
  zip: string;
  city: string;
  // Austrian specific
  stiege?: string;
  tuer?: string;
  top?: string;
  // Delivery notes
  access_notes?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// PRODUCTS
// ============================================

export interface Product {
  id: string;
  sku: string;
  name: string;
  name_de: string;
  name_at: string;
  description?: string;
  product_type: ProductType;
  unit: ProductUnit;
  unit_quantity: number; // e.g., 975 for palette (65 bags × 15kg)
  price_net_de: number;  // Price in cents
  price_net_at: number;
  min_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// ORDERS
// ============================================

export interface OrderItem {
  id: string;
  order_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit: ProductUnit;
  unit_price_net: number;  // cents
  line_total_net: number;  // cents
}

export interface TotalsSnapshot {
  subtotal_net: number;    // cents
  shipping_net: number;    // cents
  surcharges_net: number;  // cents
  vat_rate: number;        // e.g., 0.07 or 0.20 or 0 for reverse charge
  vat_label: string;       // "MwSt." or "USt."
  vat_amount: number;      // cents
  total_gross: number;     // cents
  is_reverse_charge?: boolean;  // true for AT B2B with valid VAT ID
}

export interface EmailFlags {
  weekend_hello_sent?: boolean;
  weekend_hello_sent_at?: string;
  confirmation_sent?: boolean;
  confirmation_sent_at?: string;
  payment_instructions_sent?: boolean;
  payment_instructions_sent_at?: string;
  cancelled_sent?: boolean;
  cancelled_sent_at?: string;
  shipped_sent?: boolean;
  shipped_sent_at?: string;
  delivered_sent?: boolean;
  delivered_sent_at?: string;
}

export interface Order {
  id: string;
  order_seq: number;            // Internal sequence (300001, 300002, ...)
  order_no: string;             // Display format "300-001"

  // Customer
  user_id?: string;             // null for guest orders
  email: string;
  phone?: string;
  customer_name: string;
  company_name?: string;
  salutation?: Salutation;      // For proper addressing in emails/invoices
  vat_id?: string;              // USt-IdNr for B2B customers
  
  // Order details
  country: Country;
  order_type: OrderType;
  status: OrderStatus;
  
  // Payment
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  
  // Items & totals (stored as snapshot)
  items: OrderItem[];
  totals: TotalsSnapshot;
  
  // Delivery
  delivery_address: Address;
  delivery_date?: string;
  delivery_window?: string;     // e.g., "08:00-12:00"
  delivery_notes?: string;
  
  // Invoice
  invoice_url?: string;
  invoice_generated_at?: string;
  
  // Email tracking
  email_flags: EmailFlags;
  needs_weekend_hello: boolean;
  
  // Status automation
  next_status_at?: string;
  status_plan_version?: number;
  
  // Admin notes
  internal_notes?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// EVENTS & AUDIT
// ============================================

export type ActorType = 'customer' | 'admin' | 'ops' | 'system';

export type OrderEventType = 
  | 'created'
  | 'status_changed'
  | 'payment_status_changed'
  | 'delivery_date_set'
  | 'email_sent'
  | 'invoice_generated'
  | 'note_added'
  | 'cancelled'
  | 'manual_override';

export interface OrderEvent {
  id: string;
  order_id: string;
  actor_user_id?: string;
  actor_type: ActorType;
  event_type: OrderEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

// ============================================
// EMAIL OUTBOX
// ============================================

export type EmailType =
  | 'weekend_hello'
  | 'confirmation'
  | 'payment_instructions'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'review_request'
  | 'invoice'
  | 'custom';

export type EmailStatus = 'pending' | 'sent' | 'failed';

export interface EmailOutbox {
  id: string;
  order_id: string;
  email_type: EmailType;
  to_email: string;
  payload: Record<string, unknown>;
  status: EmailStatus;
  error_message?: string;
  attempts?: number;
  created_at: string;
  sent_at?: string;
}

// ============================================
// CONFIG
// ============================================

export interface CountryConfig {
  code: Country;
  name: string;
  vat_rate: number;
  vat_label: string;
  currency: string;
  locale: string;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ============================================
// METRICS
// ============================================

export interface OrderMetrics {
  total_orders: number;
  total_revenue_gross: number;
  by_type: {
    normal: number;
    preorder: number;
  };
  by_payment_method: Record<PaymentMethod, number>;
  by_country: Record<Country, number>;
  orders_with_invoice: number;
  orders_pending_email: number;
}

export interface DashboardMetrics {
  today: OrderMetrics;
  yesterday: OrderMetrics;
  last_7_days: OrderMetrics;
  all_time: OrderMetrics;
}

// ============================================
// FORMS & INPUT
// ============================================

export interface CreateOrderInput {
  country: Country;
  order_type: OrderType;
  email: string;
  phone?: string;
  customer_name: string;
  company_name?: string;
  items: {
    sku: string;
    quantity: number;
  }[];
  delivery_address: Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
  delivery_date?: string;
  delivery_notes?: string;
  payment_method: PaymentMethod;
}

export interface UpdateOrderStatusInput {
  order_id: string;
  status: OrderStatus;
  reason?: string;
}

export interface SetDeliveryInput {
  order_id: string;
  delivery_date: string;
  delivery_window?: string;
}

