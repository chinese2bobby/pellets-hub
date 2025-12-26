import { User, UserRole, CustomerProfile, Country } from '@/types';
import { IUserRepository, IProfileRepository, ISessionRepository } from '@/repositories/interfaces';
import { generateId } from '@/lib/utils';

// Simple password hashing for Phase 1
// In production, use bcrypt or argon2
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Generate session token
function generateSessionToken(): string {
  return crypto.randomUUID() + '-' + Date.now().toString(36);
}

// ============================================
// AUTH SERVICE
// Phase 1: Simple email/password auth
// Phase 2: Swap to Supabase Auth
// ============================================

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  company_name?: string;
  default_country?: Country;
}

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private profileRepo: IProfileRepository,
    private sessionRepo: ISessionRepository,
  ) {}

  // ==========================================
  // REGISTRATION
  // ==========================================

  async register(input: RegisterInput): Promise<AuthResult> {
    // Check if user exists
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      return { success: false, error: 'Diese E-Mail-Adresse ist bereits registriert.' };
    }

    // Validate password
    if (input.password.length < 8) {
      return { success: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' };
    }

    try {
      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Create user
      const user = await this.userRepo.create({
        email: input.email.toLowerCase(),
        password_hash: passwordHash,
        role: 'customer',
      });

      // Create profile
      await this.profileRepo.create({
        user_id: user.id,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone,
        company_name: input.company_name,
        default_country: input.default_country || 'AT',
      });

      // Create session
      const token = generateSessionToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await this.sessionRepo.create(user.id, token, expiresAt);

      return { success: true, user, token };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.' };
    }
  }

  // ==========================================
  // LOGIN
  // ==========================================

  async login(email: string, password: string): Promise<AuthResult> {
    // Find user
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return { success: false, error: 'Ungültige E-Mail-Adresse oder Passwort.' };
    }

    // Verify password
    if (!user.password_hash) {
      return { success: false, error: 'Konto nicht aktiviert.' };
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return { success: false, error: 'Ungültige E-Mail-Adresse oder Passwort.' };
    }

    // Create session
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.sessionRepo.create(user.id, token, expiresAt);

    return { success: true, user, token };
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async logout(token: string): Promise<void> {
    await this.sessionRepo.delete(token);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepo.deleteByUserId(userId);
  }

  // ==========================================
  // SESSION VALIDATION
  // ==========================================

  async validateSession(token: string): Promise<User | null> {
    const session = await this.sessionRepo.findByToken(token);
    if (!session) return null;

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      await this.sessionRepo.delete(token);
      return null;
    }

    return this.userRepo.findById(session.user_id);
  }

  async getCurrentUser(token: string): Promise<{ user: User; profile: CustomerProfile | null } | null> {
    const user = await this.validateSession(token);
    if (!user) return null;

    const profile = await this.profileRepo.findByUserId(user.id);
    return { user, profile };
  }

  // ==========================================
  // PASSWORD RESET (Placeholder)
  // ==========================================

  async requestPasswordReset(email: string): Promise<{ success: boolean }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return { success: true };
    }

    // TODO: Generate reset token, save to DB, send email via outbox
    console.log(`[AuthService] Password reset requested for ${email}`);
    
    return { success: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<AuthResult> {
    // TODO: Validate reset token, update password
    return { success: false, error: 'Passwort-Reset ist noch nicht implementiert.' };
  }

  // ==========================================
  // ADMIN CHECKS
  // ==========================================

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    return user?.role === 'admin';
  }

  async isAdminOrOps(userId: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    return user?.role === 'admin' || user?.role === 'ops';
  }

  async requireAdmin(token: string): Promise<User> {
    const user = await this.validateSession(token);
    if (!user) throw new Error('Nicht authentifiziert');
    if (user.role !== 'admin') throw new Error('Keine Admin-Berechtigung');
    return user;
  }

  async requireAdminOrOps(token: string): Promise<User> {
    const user = await this.validateSession(token);
    if (!user) throw new Error('Nicht authentifiziert');
    if (user.role !== 'admin' && user.role !== 'ops') {
      throw new Error('Keine Berechtigung');
    }
    return user;
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  async cleanupExpiredSessions(): Promise<void> {
    await this.sessionRepo.deleteExpired();
  }
}

