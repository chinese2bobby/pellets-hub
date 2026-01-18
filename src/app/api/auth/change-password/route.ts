import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword, verifyPassword } from '@/lib/auth';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(`change-pwd:${ip}`, RATE_LIMITS.passwordReset);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Zu viele Anfragen. Bitte warten Sie.' },
        { status: 429 }
      );
    }

    // Check if user is logged in
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Nicht angemeldet' },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Alle Felder sind erforderlich' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Das neue Passwort muss mindestens 8 Zeichen lang sein' },
        { status: 400 }
      );
    }

    const supabase = await createAdminSupabaseClient();

    // Get user from database
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('email', user.email.toLowerCase())
      .single();

    if (userError || !dbUser) {
      return NextResponse.json(
        { success: false, error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    // Verify current password (supports both bcrypt and legacy SHA-256)
    const isValid = await verifyPassword(currentPassword, dbUser.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Aktuelles Passwort ist falsch' },
        { status: 400 }
      );
    }

    // Update password with bcrypt
    const newHash = await hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash })
      .eq('id', dbUser.id);

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Fehler beim Ändern des Passworts' },
        { status: 500 }
      );
    }

    console.log(`✅ Password changed for ${user.email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}
