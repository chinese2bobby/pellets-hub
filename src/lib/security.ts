/**
 * Security utilities for bot protection, rate limiting, brute force prevention
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';

// ============================================
// RATE LIMITING (In-Memory)
// ============================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 30 }
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetIn: entry.resetTime - now };
}

// ============================================
// BRUTE FORCE PROTECTION
// ============================================

interface BruteForceEntry {
  attempts: number;
  blockedUntil: number | null;
  lastAttempt: number;
}

const bruteForceStore = new Map<string, BruteForceEntry>();

// Clean up old entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of bruteForceStore.entries()) {
    // Remove entries older than 1 hour with no recent activity
    if (now - entry.lastAttempt > 60 * 60 * 1000) {
      bruteForceStore.delete(key);
    }
  }
}, 30 * 60 * 1000);

export interface BruteForceConfig {
  maxAttempts: number;  // Max failed attempts before block
  blockDurationMs: number;  // How long to block
  windowMs: number;  // Time window for counting attempts
}

const defaultBruteForceConfig: BruteForceConfig = {
  maxAttempts: 5,
  blockDurationMs: 15 * 60 * 1000,  // 15 minutes
  windowMs: 60 * 60 * 1000,  // 1 hour window
};

export function checkBruteForce(
  identifier: string,
  config: BruteForceConfig = defaultBruteForceConfig
): { allowed: boolean; attemptsRemaining: number; blockedFor: number | null } {
  const now = Date.now();
  const entry = bruteForceStore.get(identifier);

  if (!entry) {
    return { allowed: true, attemptsRemaining: config.maxAttempts, blockedFor: null };
  }

  // Check if blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, attemptsRemaining: 0, blockedFor: entry.blockedUntil - now };
  }

  // Reset if block expired
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    bruteForceStore.delete(identifier);
    return { allowed: true, attemptsRemaining: config.maxAttempts, blockedFor: null };
  }

  // Check if attempts should be reset (window passed)
  if (now - entry.lastAttempt > config.windowMs) {
    bruteForceStore.delete(identifier);
    return { allowed: true, attemptsRemaining: config.maxAttempts, blockedFor: null };
  }

  return {
    allowed: true,
    attemptsRemaining: config.maxAttempts - entry.attempts,
    blockedFor: null,
  };
}

export function recordFailedAttempt(
  identifier: string,
  config: BruteForceConfig = defaultBruteForceConfig
): void {
  const now = Date.now();
  const entry = bruteForceStore.get(identifier);

  if (!entry) {
    bruteForceStore.set(identifier, {
      attempts: 1,
      blockedUntil: null,
      lastAttempt: now,
    });
    return;
  }

  entry.attempts++;
  entry.lastAttempt = now;

  if (entry.attempts >= config.maxAttempts) {
    entry.blockedUntil = now + config.blockDurationMs;
  }
}

export function clearFailedAttempts(identifier: string): void {
  bruteForceStore.delete(identifier);
}

// ============================================
// BOT PROTECTION (Honeypot + Time + JS Token)
// ============================================

// Secret for generating tokens (should be env var in production)
const BOT_TOKEN_SECRET = process.env.BOT_TOKEN_SECRET || 'pelletor-bot-protection-2024';

/**
 * Generate a bot protection token (call on page load)
 */
export function generateBotToken(): { token: string; timestamp: number } {
  const timestamp = Date.now();
  const data = `${timestamp}:${BOT_TOKEN_SECRET}`;
  const token = crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
  return { token, timestamp };
}

/**
 * Verify bot protection on form submit
 */
export function verifyBotProtection(data: {
  botToken?: string;
  botTimestamp?: number;
  honeypot?: string;  // Should be empty
}): { valid: boolean; reason?: string } {
  // 1. Honeypot check - if filled, it's a bot
  if (data.honeypot && data.honeypot.length > 0) {
    return { valid: false, reason: 'honeypot_filled' };
  }

  // 2. Token presence check
  if (!data.botToken || !data.botTimestamp) {
    return { valid: false, reason: 'missing_token' };
  }

  // 3. Time check - form submitted too fast (less than 2 seconds)
  const now = Date.now();
  const submitTime = now - data.botTimestamp;
  if (submitTime < 2000) {
    return { valid: false, reason: 'too_fast' };
  }

  // 4. Time check - token too old (more than 1 hour)
  if (submitTime > 60 * 60 * 1000) {
    return { valid: false, reason: 'token_expired' };
  }

  // 5. Token validity check
  const expectedData = `${data.botTimestamp}:${BOT_TOKEN_SECRET}`;
  const expectedToken = crypto.createHash('sha256').update(expectedData).digest('hex').slice(0, 32);
  if (data.botToken !== expectedToken) {
    return { valid: false, reason: 'invalid_token' };
  }

  return { valid: true };
}

// ============================================
// HELPERS
// ============================================

/**
 * Get client IP from request
 */
export function getClientIP(request: NextRequest): string {
  // Vercel/Cloudflare headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return 'unknown';
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '')  // Remove basic HTML tags
    .replace(/javascript:/gi, '')  // Remove javascript: protocol
    .replace(/on\w+=/gi, '');  // Remove event handlers
}

/**
 * Validate email format strictly
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate phone number
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return true; // Phone is often optional

  const phoneRegex = /^[+]?[0-9\s()-]{6,20}$/;
  return phoneRegex.test(phone);
}

// ============================================
// RATE LIMIT CONFIGS FOR DIFFERENT ENDPOINTS
// ============================================

export const RATE_LIMITS = {
  // Login: 10 attempts per minute
  login: { windowMs: 60000, maxRequests: 10 },

  // Password reset: 3 per minute
  passwordReset: { windowMs: 60000, maxRequests: 3 },

  // Order submit: 5 per minute
  orderSubmit: { windowMs: 60000, maxRequests: 5 },

  // Registration: 3 per minute
  register: { windowMs: 60000, maxRequests: 3 },

  // General API: 60 per minute
  api: { windowMs: 60000, maxRequests: 60 },

  // Contact form: 5 per minute
  contact: { windowMs: 60000, maxRequests: 5 },
};
