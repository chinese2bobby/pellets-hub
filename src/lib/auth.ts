// Auth with Supabase database
import { cookies } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import bcrypt from 'bcryptjs';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
}

// BCRYPT cost factor (10-12 is good balance of security/speed)
const BCRYPT_ROUNDS = 12;

/**
 * Hash password with bcrypt (secure)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against hash (supports both bcrypt and legacy SHA-256)
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Bcrypt hashes start with $2a$, $2b$, or $2y$
  if (hash.startsWith('$2')) {
    return bcrypt.compare(password, hash);
  }

  // Legacy SHA-256 (64 char hex string)
  if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const legacyHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hash === legacyHash;
  }

  return false;
}

/**
 * Check if hash needs upgrade from SHA-256 to bcrypt
 */
export function needsHashUpgrade(hash: string): boolean {
  return !hash.startsWith('$2');
}

const SESSION_COOKIE = 'pelletor_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'pelletor-session-secret-change-in-production';

// Create signed session token
function createSessionToken(user: AuthUser): string {
  const payload = {
    ...user,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const data = JSON.stringify(payload);
  const signature = createHmacSignature(data);
  return Buffer.from(`${data}|${signature}`).toString('base64');
}

function createHmacSignature(data: string): string {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
}

function parseSessionToken(token: string): AuthUser | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [data, signature] = decoded.split('|');

    // Verify signature
    const expectedSignature = createHmacSignature(data);
    if (signature !== expectedSignature) {
      console.log('Invalid session signature');
      return null;
    }

    const payload = JSON.parse(data);
    if (payload.exp < Date.now()) return null;

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AuthUser | null> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Find user by email
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, email, password_hash, role')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !dbUser) {
      console.log('User not found:', email);
      return null;
    }

    // Verify password (supports both bcrypt and legacy SHA-256)
    const isValid = await verifyPassword(password, dbUser.password_hash);
    if (!isValid) {
      console.log('Invalid password for:', email);
      return null;
    }

    // Upgrade hash from SHA-256 to bcrypt if needed
    if (needsHashUpgrade(dbUser.password_hash)) {
      const newHash = await hashPassword(password);
      await supabase
        .from('users')
        .update({ password_hash: newHash })
        .eq('id', dbUser.id);
      console.log('🔐 Upgraded password hash to bcrypt for:', email);
    }

    // Get profile for name
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('first_name, last_name')
      .eq('user_id', dbUser.id)
      .single();

    // Also check users table for name
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', dbUser.id)
      .single();

    const userName = userData?.name
      || (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '')
      || email.split('@')[0];

    const user: AuthUser = {
      id: dbUser.id,
      email: dbUser.email,
      name: userName || 'Kunde',
      role: dbUser.role === 'admin' || dbUser.role === 'ops' ? 'admin' : 'customer',
    };

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    console.log('✅ Login successful:', email, 'role:', user.role);
    return user;
  } catch (err) {
    console.error('Login error:', err);
    return null;
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return parseSessionToken(token);
}

export async function requireAuth(allowedRoles?: ('admin' | 'customer')[]): Promise<AuthUser> {
  const user = await getSession();
  if (!user) {
    throw new Error('Unauthorized');
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new Error('Forbidden');
  }
  return user;
}
