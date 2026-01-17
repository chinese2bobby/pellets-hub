import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

const resend = new Resend(process.env.RESEND_API_KEY);

// Hash password with SHA-256
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email template for reset code
function getResetEmailHtml(code: string): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #2D5016; padding: 20px 40px; text-align: center;">
              <img src="https://pelletor.de/assets/logopelletor.png" alt="Pelletor" style="height: 32px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #333333; font-size: 15px; line-height: 1.6;">
                Guten Tag,
              </p>
              <p style="margin: 0 0 32px; color: #555555; font-size: 15px; line-height: 1.6;">
                Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt. Verwenden Sie den folgenden Code:
              </p>

              <!-- Code Box -->
              <div style="background-color: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 28px;">
                <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #2D5016;">
                  ${code}
                </div>
                <p style="margin: 10px 0 0; color: #888888; font-size: 13px;">
                  Gültig für 15 Minuten
                </p>
              </div>

              <p style="margin: 0 0 24px; color: #555555; font-size: 14px; line-height: 1.6;">
                Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren. Ihr Passwort bleibt unverändert.
              </p>

              <!-- Security Note -->
              <div style="background-color: #fff8e6; border-left: 4px solid #f0a000; padding: 14px 16px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #7a5800; font-size: 13px; line-height: 1.5;">
                  <strong>Sicherheitshinweis:</strong> Teilen Sie diesen Code niemals mit anderen Personen. Pelletor-Mitarbeiter werden Sie niemals nach diesem Code fragen.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; color: #888888; font-size: 12px; line-height: 1.5; text-align: center;">
                Diese E-Mail wurde automatisch versendet.<br>
                Bei Fragen erreichen Sie uns unter <a href="mailto:info@pelletor.de" style="color: #2D5016; text-decoration: none;">info@pelletor.de</a>
              </p>
              <p style="margin: 16px 0 0; color: #aaaaaa; font-size: 11px; text-align: center;">
                © ${new Date().getFullYear()} Pelletor · Or Projekt GmbH
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// POST /api/auth/reset-password
// Actions: request (send code) or verify (check code + reset password)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const supabase = await createAdminSupabaseClient();

    // ==========================================
    // ACTION: REQUEST - Send reset code
    // ==========================================
    if (action === 'request') {
      const { email } = body;

      if (!email) {
        return NextResponse.json(
          { success: false, error: 'E-Mail-Adresse erforderlich' },
          { status: 400 }
        );
      }

      // Find user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email.toLowerCase())
        .single();

      // Don't reveal if user exists or not for security
      if (userError || !user) {
        // Still return success to prevent email enumeration
        console.log(`Password reset requested for unknown email: ${email}`);
        return NextResponse.json({
          success: true,
          message: 'Falls ein Konto mit dieser E-Mail existiert, erhalten Sie in Kürze einen Code.'
        });
      }

      // Generate code and expiry (15 minutes)
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // Store code in users table
      const { error: updateError } = await supabase
        .from('users')
        .update({
          reset_code: code,
          reset_code_expires_at: expiresAt
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to store reset code:', updateError);
        return NextResponse.json(
          { success: false, error: 'Fehler beim Speichern des Codes' },
          { status: 500 }
        );
      }

      // Send email via Resend
      try {
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: `Pelletor <${process.env.RESEND_FROM_EMAIL || 'bestellung@pelletor.de'}>`,
          to: user.email,
          subject: 'Ihr Passwort-Reset-Code – Pelletor',
          html: getResetEmailHtml(code),
        });

        if (emailError) {
          console.error('Resend error:', emailError);
          return NextResponse.json(
            { success: false, error: 'Fehler beim Senden der E-Mail' },
            { status: 500 }
          );
        }

        console.log(`✅ Reset code sent to ${user.email}, messageId: ${emailData?.id}`);
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
        return NextResponse.json(
          { success: false, error: 'Fehler beim Senden der E-Mail' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Falls ein Konto mit dieser E-Mail existiert, erhalten Sie in Kürze einen Code.'
      });
    }

    // ==========================================
    // ACTION: CHECK - Only verify code is valid
    // ==========================================
    if (action === 'check') {
      const { email, code } = body;

      if (!email || !code) {
        return NextResponse.json(
          { success: false, error: 'E-Mail und Code erforderlich' },
          { status: 400 }
        );
      }

      // Find user with matching code
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, reset_code, reset_code_expires_at')
        .eq('email', email.toLowerCase())
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { success: false, error: 'Ungültiger Code' },
          { status: 400 }
        );
      }

      // Check code matches
      if (user.reset_code !== code) {
        return NextResponse.json(
          { success: false, error: 'Ungültiger Code' },
          { status: 400 }
        );
      }

      // Check code not expired
      if (!user.reset_code_expires_at || new Date(user.reset_code_expires_at) < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Code ist abgelaufen. Bitte fordern Sie einen neuen an.' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, valid: true });
    }

    // ==========================================
    // ACTION: VERIFY - Check code and reset password
    // ==========================================
    if (action === 'verify') {
      const { email, code, newPassword } = body;

      if (!email || !code || !newPassword) {
        return NextResponse.json(
          { success: false, error: 'Alle Felder sind erforderlich' },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: 'Passwort muss mindestens 8 Zeichen lang sein' },
          { status: 400 }
        );
      }

      // Find user with matching code
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, reset_code, reset_code_expires_at')
        .eq('email', email.toLowerCase())
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { success: false, error: 'Ungültiger Code' },
          { status: 400 }
        );
      }

      // Check code matches
      if (user.reset_code !== code) {
        return NextResponse.json(
          { success: false, error: 'Ungültiger Code' },
          { status: 400 }
        );
      }

      // Check code not expired
      if (!user.reset_code_expires_at || new Date(user.reset_code_expires_at) < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Code ist abgelaufen. Bitte fordern Sie einen neuen an.' },
          { status: 400 }
        );
      }

      // Hash new password and update user
      const passwordHash = await hashPassword(newPassword);

      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          reset_code: null,
          reset_code_expires_at: null
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Password update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Fehler beim Ändern des Passworts' },
          { status: 500 }
        );
      }

      console.log(`✅ Password reset successful for ${user.email}`);

      return NextResponse.json({
        success: true,
        message: 'Passwort erfolgreich geändert'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Ungültige Aktion' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}
