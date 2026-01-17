import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setup() {
  console.log('Setting up profile and addresses tables...\n');

  // First, check if users table has name and phone columns
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (usersError) {
    console.error('Error checking users table:', usersError);
    console.log('\n⚠️  Please run this SQL in Supabase SQL Editor:\n');
    console.log(`
-- Add name and phone columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Zuhause',
  name TEXT NOT NULL,
  street TEXT NOT NULL,
  zip TEXT NOT NULL,
  city TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- Enable RLS
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Policy for addresses (service role can do everything)
CREATE POLICY "Service role can manage addresses" ON addresses
  FOR ALL USING (true);
    `);
    return;
  }

  // Check if columns exist
  const sampleUser = users?.[0];
  const hasName = sampleUser && 'name' in sampleUser;
  const hasPhone = sampleUser && 'phone' in sampleUser;

  if (!hasName || !hasPhone) {
    console.log('⚠️  Missing columns in users table. Please run this SQL:\n');
    console.log(`
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
    `);
  } else {
    console.log('✅ Users table has name and phone columns');
  }

  // Check if addresses table exists
  const { data: addresses, error: addressesError } = await supabase
    .from('addresses')
    .select('*')
    .limit(1);

  if (addressesError && addressesError.code === '42P01') {
    console.log('\n⚠️  Addresses table does not exist. Please run this SQL:\n');
    console.log(`
CREATE TABLE addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Zuhause',
  name TEXT NOT NULL,
  street TEXT NOT NULL,
  zip TEXT NOT NULL,
  city TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage addresses" ON addresses
  FOR ALL USING (true);
    `);
  } else if (addressesError) {
    console.error('Error checking addresses table:', addressesError);
  } else {
    console.log('✅ Addresses table exists');
  }

  console.log('\n✅ Setup check complete!');
}

setup().catch(console.error);
