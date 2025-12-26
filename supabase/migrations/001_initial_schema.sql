-- ============================================
-- PELLETS HUB - Initial Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('customer', 'admin', 'ops');
CREATE TYPE country_code AS ENUM ('DE', 'AT');
CREATE TYPE order_type AS ENUM ('normal', 'preorder');
CREATE TYPE order_status AS ENUM (
  'received',
  'confirmed', 
  'planning_delivery',
  'shipped',
  'in_transit',
  'delivered',
  'cancelled'
);
CREATE TYPE payment_method AS ENUM ('vorkasse', 'lastschrift', 'paypal', 'klarna');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
CREATE TYPE product_unit AS ENUM ('palette', 'kg', 'silo');
CREATE TYPE actor_type AS ENUM ('customer', 'admin', 'ops', 'system');
CREATE TYPE email_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE email_type AS ENUM (
  'weekend_hello',
  'confirmation',
  'payment_instructions',
  'shipped',
  'in_transit',
  'delivered',
  'cancelled',
  'review_request'
);

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- Phase 1: simple auth
  role user_role NOT NULL DEFAULT 'customer',
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- CUSTOMER PROFILES
-- ============================================

CREATE TABLE customer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  vat_id TEXT,
  default_country country_code DEFAULT 'AT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_user ON customer_profiles(user_id);

-- ============================================
-- ADDRESSES
-- ============================================

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT, -- e.g., "Zuhause", "Büro"
  country country_code NOT NULL,
  street TEXT NOT NULL,
  house_no TEXT NOT NULL,
  zip TEXT NOT NULL,
  city TEXT NOT NULL,
  -- Austrian specific
  stiege TEXT,
  tuer TEXT,
  top TEXT,
  -- Delivery notes
  access_notes TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

-- ============================================
-- PRODUCTS
-- ============================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_de TEXT NOT NULL,
  name_at TEXT NOT NULL,
  description TEXT,
  product_type TEXT NOT NULL, -- 'premium_lose', 'premium_sack', 'eco_palette'
  unit product_unit NOT NULL,
  unit_quantity INTEGER NOT NULL, -- e.g., 975 for palette
  price_net_de INTEGER NOT NULL, -- cents
  price_net_at INTEGER NOT NULL, -- cents
  min_quantity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(is_active);

-- ============================================
-- ORDER SEQUENCE
-- ============================================

-- Sequence for order numbers starting at 300001
CREATE SEQUENCE order_seq START WITH 300001;

-- ============================================
-- ORDERS
-- ============================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_seq INTEGER UNIQUE NOT NULL DEFAULT nextval('order_seq'),
  order_no TEXT NOT NULL, -- Format: "300-001"
  
  -- Customer info
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  phone TEXT,
  customer_name TEXT NOT NULL,
  company_name TEXT,
  
  -- Order details
  country country_code NOT NULL,
  order_type order_type NOT NULL DEFAULT 'normal',
  status order_status NOT NULL DEFAULT 'received',
  
  -- Payment
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  
  -- Items snapshot (stored as JSONB array)
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- Structure: [{sku, name, quantity, unit, unit_price_net, line_total_net}]
  
  -- Totals snapshot (stored as JSONB)
  totals JSONB NOT NULL,
  -- Structure: {
  --   subtotal_net: number,
  --   shipping_net: number,
  --   surcharges_net: number,
  --   vat_rate: number,
  --   vat_label: string,
  --   vat_amount: number,
  --   total_gross: number
  -- }
  
  -- Delivery address snapshot
  delivery_address JSONB NOT NULL,
  delivery_date DATE,
  delivery_window TEXT, -- e.g., "08:00-12:00"
  delivery_notes TEXT,
  
  -- Invoice
  invoice_url TEXT,
  invoice_generated_at TIMESTAMPTZ,
  
  -- Email flags
  email_flags JSONB DEFAULT '{}'::JSONB,
  needs_weekend_hello BOOLEAN DEFAULT FALSE,
  
  -- Status automation
  next_status_at TIMESTAMPTZ,
  status_plan_version INTEGER DEFAULT 1,
  
  -- Admin notes
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_orders_country ON orders(country);
CREATE INDEX idx_orders_payment_method ON orders(payment_method);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_next_status ON orders(next_status_at) WHERE next_status_at IS NOT NULL;
CREATE INDEX idx_orders_weekend_hello ON orders(needs_weekend_hello) WHERE needs_weekend_hello = TRUE;

-- ============================================
-- ORDER ITEMS
-- ============================================

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit product_unit NOT NULL,
  unit_price_net INTEGER NOT NULL, -- cents
  line_total_net INTEGER NOT NULL, -- cents
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- ORDER EVENTS (Audit Log)
-- ============================================

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type actor_type NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_order ON order_events(order_id);
CREATE INDEX idx_events_created ON order_events(created_at DESC);
CREATE INDEX idx_events_type ON order_events(event_type);

-- ============================================
-- EMAIL OUTBOX
-- ============================================

CREATE TABLE email_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  email_type email_type NOT NULL,
  to_email TEXT NOT NULL,
  payload JSONB NOT NULL,
  status email_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_order ON email_outbox(order_id);
CREATE INDEX idx_outbox_status ON email_outbox(status);
CREATE INDEX idx_outbox_pending ON email_outbox(created_at) WHERE status = 'pending';

-- ============================================
-- COUNTRY CONFIG
-- ============================================

CREATE TABLE country_config (
  code country_code PRIMARY KEY,
  name TEXT NOT NULL,
  vat_rate DECIMAL(4,3) NOT NULL,
  vat_label TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  locale TEXT NOT NULL,
  shipping_cost INTEGER NOT NULL, -- cents
  free_shipping_threshold INTEGER NOT NULL, -- cents
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default country configs
INSERT INTO country_config (code, name, vat_rate, vat_label, locale, shipping_cost, free_shipping_threshold) VALUES
  ('DE', 'Deutschland', 0.07, 'MwSt.', 'de-DE', 4990, 49990),
  ('AT', 'Österreich', 0.20, 'USt.', 'de-AT', 3990, 49990);

-- ============================================
-- COMPANY SETTINGS
-- ============================================

CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SESSIONS (Phase 1 simple auth)
-- ============================================

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_users_timestamp
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_profiles_timestamp
  BEFORE UPDATE ON customer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_addresses_timestamp
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_products_timestamp
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_timestamp
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS POLICIES (Basic - expand as needed)
-- ============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Customer profiles
CREATE POLICY "Users can view own customer profile" ON customer_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own customer profile" ON customer_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customer profile" ON customer_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Addresses
CREATE POLICY "Users can view own addresses" ON addresses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own addresses" ON addresses
  FOR ALL USING (auth.uid() = user_id);

-- Orders - users can view their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Order items
CREATE POLICY "Users can view own order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = auth.uid()
    )
  );

-- Order events
CREATE POLICY "Users can view own order events" ON order_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_events.order_id 
      AND orders.user_id = auth.uid()
    )
  );

-- ============================================
-- SEED DATA: Products
-- ============================================

INSERT INTO products (sku, name, name_de, name_at, description, product_type, unit, unit_quantity, price_net_de, price_net_at, min_quantity, sort_order) VALUES
  (
    'PREM-LOSE',
    'Premium Pellets Lose',
    'Premium Pellets Lose (Silo)',
    'Premium Pellets Lose (Silo)',
    'Premium Holzpellets lose für Silobefüllung. ENplus A1 zertifiziert. Min. 500kg.',
    'premium_lose',
    'silo',
    1,
    28900, -- €289.00 per 1000kg (€0.289/kg)
    27900, -- €279.00 per 1000kg
    500,
    1
  ),
  (
    'PREM-SACK',
    'Premium Pellets Sackware',
    'Premium Pellets auf Palette (65 Säcke à 15kg)',
    'Premium Pellets auf Palette (65 Säcke à 15kg)',
    '65 Säcke à 15kg = 975kg pro Palette. ENplus A1 zertifiziert. Bequeme Handhabung.',
    'premium_sack',
    'palette',
    975,
    31900, -- €319.00 per palette
    30900, -- €309.00 per palette
    1,
    2
  ),
  (
    'ECO-PAL',
    'Eco Pellets Palette',
    'Eco Pellets auf Palette (65 Säcke à 15kg)',
    'Eco Pellets auf Palette (65 Säcke à 15kg)',
    'Günstige Holzpellets für preisbewusste Kunden. 65 Säcke à 15kg = 975kg.',
    'eco_palette',
    'palette',
    975,
    27900, -- €279.00 per palette
    26900, -- €269.00 per palette
    1,
    3
  );

-- ============================================
-- SEED DATA: Admin User (change password!)
-- ============================================

-- Password: admin123 (bcrypt hash - CHANGE IN PRODUCTION!)
INSERT INTO users (email, password_hash, role, email_verified) VALUES
  ('admin@pelletor.at', '$2a$10$rQnM1jKYxhVVFYgKHPXGIebPHjGqyPHqNqRfZvXAF/DzHwKjH8yVm', 'admin', TRUE);

