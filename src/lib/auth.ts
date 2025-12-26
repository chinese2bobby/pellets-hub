// Simple auth for testing - Mastermind Edition 🧠
// Replace with proper auth (NextAuth, Supabase Auth) in production

import { cookies } from 'next/headers';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
}

// Test accounts - Mastermind style 🧠
export const TEST_ACCOUNTS = {
  admin: {
    id: 'admin-mastermind-001',
    email: 'admin@pelletor.de',
    password: 'Mastermind2025!',
    name: 'Mastermind Admin',
    role: 'admin' as const,
  },
  customer: {
    id: 'customer-mastermind-001', 
    email: 'kevin@mastermind.io',
    password: 'Kevin2025!',
    name: 'Kevin Hall',
    role: 'customer' as const,
  },
};

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
  // Check admin account
  if (email === TEST_ACCOUNTS.admin.email && password === TEST_ACCOUNTS.admin.password) {
    const user: AuthUser = {
      id: TEST_ACCOUNTS.admin.id,
      email: TEST_ACCOUNTS.admin.email,
      name: TEST_ACCOUNTS.admin.name,
      role: TEST_ACCOUNTS.admin.role,
    };
    
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });
    
    return user;
  }
  
  // Check customer account
  if (email === TEST_ACCOUNTS.customer.email && password === TEST_ACCOUNTS.customer.password) {
    const user: AuthUser = {
      id: TEST_ACCOUNTS.customer.id,
      email: TEST_ACCOUNTS.customer.email,
      name: TEST_ACCOUNTS.customer.name,
      role: TEST_ACCOUNTS.customer.role,
    };
    
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });
    
    return user;
  }
  
  return null;
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

