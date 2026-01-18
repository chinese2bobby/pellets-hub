-- Add invoice_token column for secure invoice access
-- This replaces predictable orderId/orderNo URLs with random tokens

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_token TEXT UNIQUE;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_orders_invoice_token ON orders(invoice_token) WHERE invoice_token IS NOT NULL;
