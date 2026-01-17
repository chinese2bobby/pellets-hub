import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

// GET /api/auth/profile - Get user profile data
export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Nicht angemeldet' },
        { status: 401 }
      );
    }

    const supabase = await createAdminSupabaseClient();

    // Get user data
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, email, name, phone')
      .eq('email', user.email.toLowerCase())
      .single();

    if (userError || !dbUser) {
      return NextResponse.json(
        { success: false, error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    // Get user addresses
    const { data: addresses, error: addressError } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', dbUser.id)
      .order('is_default', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        name: dbUser.name || user.name,
        email: dbUser.email,
        phone: dbUser.phone || '',
        addresses: (addresses || []).map(addr => ({
          id: addr.id,
          label: addr.label,
          name: addr.name,
          street: addr.street,
          zip: addr.zip,
          city: addr.city,
          isDefault: addr.is_default
        }))
      }
    });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}

// PUT /api/auth/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Nicht angemeldet' },
        { status: 401 }
      );
    }

    const { name, phone } = await request.json();

    const supabase = await createAdminSupabaseClient();

    // Update user data
    const { error: updateError } = await supabase
      .from('users')
      .update({
        name: name || null,
        phone: phone || null
      })
      .eq('email', user.email.toLowerCase());

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Fehler beim Speichern' },
        { status: 500 }
      );
    }

    console.log(`Profile updated for ${user.email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}
