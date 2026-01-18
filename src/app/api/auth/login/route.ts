import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/auth';
import {
  checkRateLimit,
  checkBruteForce,
  recordFailedAttempt,
  clearFailedAttempts,
  getClientIP,
  RATE_LIMITS
} from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    // Rate limiting
    const rateCheck = checkRateLimit(`login:${ip}`, RATE_LIMITS.login);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Zu viele Anfragen. Bitte warten Sie einige Minuten.' },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'E-Mail und Passwort erforderlich' },
        { status: 400 }
      );
    }

    // Brute force check (per email + IP combination)
    const bruteForceKey = `login:${email.toLowerCase()}:${ip}`;
    const bruteCheck = checkBruteForce(bruteForceKey);
    if (!bruteCheck.allowed) {
      const minutesLeft = Math.ceil((bruteCheck.blockedFor || 0) / 60000);
      return NextResponse.json(
        {
          success: false,
          error: `Zu viele fehlgeschlagene Versuche. Bitte warten Sie ${minutesLeft} Minuten.`
        },
        { status: 429 }
      );
    }

    const user = await login(email, password);

    if (!user) {
      // Record failed attempt
      recordFailedAttempt(bruteForceKey);

      // Don't reveal which field is wrong
      return NextResponse.json(
        { success: false, error: 'E-Mail oder Passwort ist falsch' },
        { status: 401 }
      );
    }

    // Clear failed attempts on successful login
    clearFailedAttempts(bruteForceKey);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        redirect: user.role === 'admin' ? '/admin' : '/account',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}
