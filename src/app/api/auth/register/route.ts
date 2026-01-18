import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth';
import {
  checkRateLimit,
  verifyBotProtection,
  getClientIP,
  sanitizeString,
  isValidEmail,
  isValidPhone,
  RATE_LIMITS
} from '@/lib/security';
import { Country } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    // Rate limiting
    const rateCheck = checkRateLimit(`register:${ip}`, RATE_LIMITS.register);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Zu viele Anfragen. Bitte warten Sie einige Minuten.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Bot protection check
    const botCheck = verifyBotProtection({
      botToken: body.botToken,
      botTimestamp: body.botTimestamp,
      honeypot: body.website, // honeypot field named "website"
    });

    if (!botCheck.valid) {
      console.log(`🤖 Bot detected on register: ${botCheck.reason} from ${ip}`);
      // Return generic error to not reveal detection
      return NextResponse.json(
        { success: false, error: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.' },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      company_name,
      default_country = 'AT'
    } = body;

    // Sanitize inputs
    const cleanEmail = sanitizeString(email, 254).toLowerCase();
    const cleanFirstName = sanitizeString(first_name, 100);
    const cleanLastName = sanitizeString(last_name, 100);
    const cleanPhone = sanitizeString(phone || '', 30);
    const cleanCompany = sanitizeString(company_name || '', 200);

    // Validate required fields
    if (!cleanEmail || !password || !cleanFirstName || !cleanLastName) {
      return NextResponse.json(
        { success: false, error: 'Alle Pflichtfelder müssen ausgefüllt werden.' },
        { status: 400 }
      );
    }

    // Validate password
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' },
        { status: 400 }
      );
    }

    // Validate phone if provided
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: 'Bitte geben Sie eine gültige Telefonnummer ein.' },
        { status: 400 }
      );
    }

    const supabase = await createAdminSupabaseClient();

    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Diese E-Mail-Adresse ist bereits registriert.' },
        { status: 409 }
      );
    }

    // Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'customer',
      })
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return NextResponse.json(
        { success: false, error: 'Benutzer konnte nicht erstellt werden.' },
        { status: 500 }
      );
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('customer_profiles')
      .insert({
        user_id: user.id,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        phone: cleanPhone || null,
        company_name: cleanCompany || null,
        default_country: default_country as Country,
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't fail the registration, just log
    }

    // Create session
    const sessionToken = crypto.randomUUID() + '-' + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token: sessionToken,
        expires_at: expiresAt.toISOString(),
      });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    console.log(`✅ New user registered: ${cleanEmail}`);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Ein Fehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}
