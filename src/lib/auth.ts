// Auth with Supabase database
import { cookies } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
}

// Hash password with SHA-256 (same as registration/reset)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const SESSION_COOKIE = 'pelletor_session';

// Simple session token (in production use JWT or proper session)
function createSessionToken(user: AuthUser): string {
  return Buffer.from(JSON.stringify({
    ...user,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  })).toString('base64');
}

function parseSessionToken(token: string): AuthUser | null {
  try {
    const data = JSON.parse(Buffer.from(token, 'base64').toString());
    if (data.exp < Date.now()) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
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

    // Verify password
    const passwordHash = await hashPassword(password);
    if (dbUser.password_hash !== passwordHash) {
      console.log('Invalid password for:', email);
      return null;
    }

    // Get profile for name
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('first_name, last_name')
      .eq('user_id', dbUser.id)
      .single();

    const userName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : email.split('@')[0];

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
      sameSite: 'lax',
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

