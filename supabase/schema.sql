-- ============================================
-- PELLETS-HUB DATABASE SCHEMA
-- Run this in Supabase SQL Editor after restoring project
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_seq SERIAL UNIQUE,

  -- Customer info
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  phone TEXT,
  customer_name TEXT NOT NULL,
  company_name TEXT,
  salutation TEXT CHECK (salutation IN ('herr', 'frau', 'firma', 'divers')),
  vat_id TEXT,

  -- Order details
  country TEXT NOT NULL CHECK (country IN ('DE', 'AT')),
  order_type TEXT NOT NULL CHECK (order_type IN ('normal', 'preorder')),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'confirmed', 'planning_delivery', 'shipped', 'in_transit', 'delivered', 'cancelled'
  )),

  -- Payment
  payment_method TEXT NOT NULL CHECK (payment_method IN (
    'vorkasse', 'rechnung', 'lastschrift', 'paypal', 'klarna'
  )),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),

  -- Totals snapshot (JSONB)
  totals JSONB NOT NULL,

  -- Delivery
  delivery_address JSONB NOT NULL,
  delivery_date DATE,
  delivery_window TEXT,
  delivery_notes TEXT,

  -- Invoice
  invoice_url TEXT,
  invoice_generated_at TIMESTAMPTZ,
  invoice_token TEXT UNIQUE,
  
  -- Secure order access token
  order_token TEXT UNIQUE,

  -- Email tracking
  email_flags JSONB DEFAULT '{}',
  needs_weekend_hello BOOLEAN DEFAULT FALSE,

  -- Status automation
  next_status_at TIMESTAMPTZ,
  status_plan_version INTEGER DEFAULT 1,

  -- Admin
  internal_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Start order_seq at 300001
ALTER SEQUENCE orders_order_seq_seq RESTART WITH 300001;

-- Index for common queries
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_next_status_at ON orders(next_status_at) WHERE next_status_at IS NOT NULL;
CREATE INDEX idx_orders_needs_weekend_hello ON orders(needs_weekend_hello) WHERE needs_weekend_hello = TRUE;
CREATE INDEX idx_orders_invoice_token ON orders(invoice_token) WHERE invoice_token IS NOT NULL;
CREATE INDEX idx_orders_order_token ON orders(order_token) WHERE order_token IS NOT NULL;

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('palette', 'kg', 'silo')),
  unit_price_net INTEGER NOT NULL, -- cents
  line_total_net INTEGER NOT NULL, -- cents

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ============================================
-- ORDER EVENTS TABLE (Audit Log)
-- ============================================
CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin', 'ops', 'system')),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'status_changed', 'payment_status_changed', 'delivery_date_set',
    'email_sent', 'invoice_generated', 'note_added', 'cancelled', 'manual_override'
  )),

  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_events_order_id ON order_events(order_id);
CREATE INDEX idx_order_events_created_at ON order_events(created_at DESC);

-- ============================================
-- EMAIL OUTBOX TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  email_type TEXT NOT NULL CHECK (email_type IN (
    'weekend_hello', 'confirmation', 'payment_instructions', 'shipped',
    'in_transit', 'delivered', 'cancelled', 'review_request', 'invoice', 'custom'
  )),
  to_email TEXT NOT NULL,

  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  attempts INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_email_outbox_status ON email_outbox(status) WHERE status = 'pending';
CREATE INDEX idx_email_outbox_order_id ON email_outbox(order_id);

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'ops')),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  company_name TEXT,
  vat_id TEXT,
  default_country TEXT CHECK (default_country IN ('DE', 'AT')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SAVED ADDRESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  country TEXT NOT NULL CHECK (country IN ('DE', 'AT')),
  street TEXT NOT NULL,
  house_no TEXT NOT NULL,
  zip TEXT NOT NULL,
  city TEXT NOT NULL,

  -- Austrian specifics
  stiege TEXT,
  tuer TEXT,
  top TEXT,

  access_notes TEXT,
  is_default BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Orders: customers see their own, admins see all
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (
    auth.uid() = user_id
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'ops'))
  );

CREATE POLICY "Admins can manage all orders" ON orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'ops'))
  );

-- Service role bypass (for API routes)
CREATE POLICY "Service role full access orders" ON orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access order_items" ON order_items
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access order_events" ON order_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access email_outbox" ON email_outbox
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access user_profiles" ON user_profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access addresses" ON addresses
  FOR ALL USING (auth.role() = 'service_role');

-- User profiles: users see own, admins see all
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Addresses: users manage own
CREATE POLICY "Users can manage own addresses" ON addresses
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER VIEWS
-- ============================================

-- Orders with items (for easier querying)
CREATE OR REPLACE VIEW orders_with_items AS
SELECT
  o.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', oi.id,
        'sku', oi.sku,
        'name', oi.name,
        'quantity', oi.quantity,
        'unit', oi.unit,
        'unit_price_net', oi.unit_price_net,
        'line_total_net', oi.line_total_net
      )
    ) FILTER (WHERE oi.id IS NOT NULL),
    '[]'
  ) AS items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id;

-- ============================================
-- SEED ADMIN USER (run after first login)
-- ============================================
-- After you create your admin account via Supabase Auth,
-- run this to give admin role:
--
-- INSERT INTO user_profiles (id, role, first_name, last_name)
-- VALUES ('YOUR-USER-UUID-HERE', 'admin', 'Admin', 'User');
