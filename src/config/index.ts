import { Country, CountryConfig, PaymentMethod, ProductType } from '@/types';

// ============================================
// COUNTRY CONFIGURATION
// ============================================

export const COUNTRY_CONFIG: Record<Country, CountryConfig> = {
  DE: {
    code: 'DE',
    name: 'Deutschland',
    vat_rate: 0.07,       // 7% for heating fuel
    vat_label: 'MwSt.',
    currency: 'EUR',
    locale: 'de-DE',
  },
  AT: {
    code: 'AT',
    name: 'Österreich',
    vat_rate: 0.20,       // 20% standard
    vat_label: 'USt.',
    currency: 'EUR',
    locale: 'de-AT',
  },
};

// ============================================
// COMPANY INFO - Or Projekt GmbH (Pelletor Brand)
// German company serving Germany and Austria
// ============================================

export const COMPANY = {
  // Brand name (customer-facing)
  name: 'Pelletor',
  // Legal entity
  legal_name: 'Or Projekt GmbH',

  address: {
    street: 'Fördepromenade 2',
    zip: '24944',
    city: 'Flensburg',
    country: 'DE' as Country,
  },

  // Managing Director
  ceo: 'Olaf Rubin',
  ceo_title: 'Geschäftsführer',

  // Contact
  phone: '+49 461 9041 2830',
  email: 'info@pelletor.at',
  support_email: 'service@pelletor.at',
  order_email: 'bestellung@pelletor.at',

  // Banking (for Vorkasse payments)
  iban: 'DE89 2175 0000 0017 2838 00',
  bic: 'NOLADE21NOS',
  bank_name: 'Nord-Ostsee Sparkasse',
  payment_recipient: 'Or Projekt GmbH',

  // Tax - German VAT ID
  vat_id: 'DE04186678',

  // Registration - Handelsregister
  company_register: 'HRB 9457',
  register_court: 'Amtsgericht Flensburg',
  register_city: '24937 Flensburg',

  // Company info
  founded: '2012',
  legal_form: 'Gesellschaft mit beschränkter Haftung',

  // Web
  domain: 'pelletor.at',
  url: 'https://pelletor.at',

  // Logo
  logo_url: 'https://pelletor.at/assets/logo.png',

  // Service areas
  service_countries: ['DE', 'AT'] as Country[],
};

// ============================================
// PRODUCTS CONFIGURATION
// ============================================

export const PRODUCTS: Record<ProductType, {
  name: string;
  name_de: string;
  name_at: string;
  sku: string;
  unit: 'palette' | 'kg' | 'silo';
  unit_label: string;
  unit_quantity_kg: number;
  description: string;
}> = {
  premium_lose: {
    name: 'Premium Pellets Lose',
    name_de: 'Premium Pellets Lose (Silo)',
    name_at: 'Premium Pellets Lose (Silo)',
    sku: 'PREM-LOSE',
    unit: 'silo',
    unit_label: 'kg',
    unit_quantity_kg: 1, // per kg pricing
    description: 'Premium Holzpellets lose für Silobefüllung. Min. 500kg.',
  },
  premium_sack: {
    name: 'Premium Pellets Sackware',
    name_de: 'Premium Pellets auf Palette (65 Säcke à 15kg)',
    name_at: 'Premium Pellets auf Palette (65 Säcke à 15kg)',
    sku: 'PREM-SACK',
    unit: 'palette',
    unit_label: 'Palette',
    unit_quantity_kg: 975, // 65 bags × 15kg
    description: '65 Säcke à 15kg = 975kg pro Palette. ENplus A1 zertifiziert.',
  },
  eco_palette: {
    name: 'Eco Pellets Palette',
    name_de: 'Eco Pellets auf Palette (65 Säcke à 15kg)',
    name_at: 'Eco Pellets auf Palette (65 Säcke à 15kg)',
    sku: 'ECO-PAL',
    unit: 'palette',
    unit_label: 'Palette',
    unit_quantity_kg: 975,
    description: 'Günstige Holzpellets für preisbewusste Kunden. 65 Säcke à 15kg.',
  },
};

// ============================================
// ORDER CONFIGURATION
// ============================================

export const ORDER_CONFIG = {
  // Order number starts at 300001, displayed as "300-001"
  sequence_start: 300001,
  
  // Minimum order value for free shipping (cents)
  free_shipping_threshold: 49990, // €499.90
  
  // Minimum quantities
  min_quantity: {
    palette: 1,
    silo: 500, // kg
  },
  
  // Shipping costs (cents)
  shipping_cost_de: 4990, // €49.90
  shipping_cost_at: 3990, // €39.90
};

// ============================================
// PAYMENT METHODS
// ============================================

export const PAYMENT_METHODS: Record<PaymentMethod, {
  label: string;
  description: string;
  enabled: boolean;
}> = {
  vorkasse: {
    label: 'Bank Transfer',
    description: 'Pay via bank transfer before delivery',
    enabled: true,
  },
  lastschrift: {
    label: 'Direct Debit (SEPA)',
    description: 'Convenient SEPA direct debit',
    enabled: true,
  },
  paypal: {
    label: 'PayPal',
    description: 'Secure payment with PayPal buyer protection',
    enabled: true,
  },
  klarna: {
    label: 'Klarna',
    description: 'Buy now, pay later',
    enabled: true,
  },
};

// ============================================
// STATUS CONFIGURATION
// ============================================

export const STATUS_CONFIG = {
  // Labels for each status
  labels: {
    received: 'Received',
    confirmed: 'Confirmed',
    planning_delivery: 'Planning',
    shipped: 'Shipped',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  },
  
  // Status badge colors (Tailwind classes)
  colors: {
    received: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-indigo-100 text-indigo-800',
    planning_delivery: 'bg-yellow-100 text-yellow-800',
    shipped: 'bg-purple-100 text-purple-800',
    in_transit: 'bg-orange-100 text-orange-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  },
  
  // Auto-transition delays (in milliseconds)
  // Min and max for random delay within window
  transitions: {
    received_to_confirmed: { min: 1 * 60 * 60 * 1000, max: 3 * 60 * 60 * 1000 },       // 1-3 hours
    confirmed_to_planning: { min: 22 * 60 * 60 * 1000, max: 48 * 60 * 60 * 1000 },     // 22-48 hours
    planning_to_shipped: { min: 15 * 60 * 60 * 1000, max: 24 * 60 * 60 * 1000 },       // 15-24 hours
    shipped_to_in_transit: { min: 1 * 60 * 60 * 1000, max: 4 * 60 * 60 * 1000 },       // 1-4 hours
    in_transit_max_ttl: 7 * 24 * 60 * 60 * 1000,                                        // 7 days max
  },
};

// ============================================
// EMAIL CONFIGURATION
// ============================================

export const EMAIL_CONFIG = {
  // Weekend hello: orders created on Saturday (6) or Sunday (0)
  weekend_days: [0, 6],
  timezone: 'Europe/Vienna',
  
  // Auto-send weekend hello or wait for admin?
  auto_send_weekend_hello: false,
};

// ============================================
// UI CONFIGURATION
// ============================================

export const UI_CONFIG = {
  // Brand colors
  colors: {
    primary: '#2D5016',      // Forest green
    primary_light: '#4A7C23',
    primary_dark: '#1A3009',
    accent: '#D4A574',       // Warm wood
    background: '#FAFAF8',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    text_muted: '#6B7280',
    border: '#E5E7EB',
    error: '#DC2626',
    success: '#16A34A',
    warning: '#D97706',
  },
  
  // Items per page
  pagination: {
    orders_per_page: 20,
    events_per_page: 50,
  },
};

