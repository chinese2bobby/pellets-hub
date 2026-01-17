import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

// GET /api/auth/addresses - Get user addresses
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

    // Get user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single();

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    // Get addresses
    const { data: addresses } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', dbUser.id)
      .order('is_default', { ascending: false });

    return NextResponse.json({
      success: true,
      data: (addresses || []).map(addr => ({
        id: addr.id,
        label: addr.label,
        name: addr.name,
        street: addr.street,
        zip: addr.zip,
        city: addr.city,
        isDefault: addr.is_default
      }))
    });
  } catch (error) {
    console.error('Addresses GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}

// POST /api/auth/addresses - Create new address
export async function POST(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Nicht angemeldet' },
        { status: 401 }
      );
    }

    const { label, name, street, zip, city, isDefault } = await request.json();

    const supabase = await createAdminSupabaseClient();

    // Get user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single();

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', dbUser.id);
    }

    // Create new address
    const { data: newAddress, error: insertError } = await supabase
      .from('addresses')
      .insert({
        user_id: dbUser.id,
        label,
        name,
        street,
        zip,
        city,
        is_default: isDefault || false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Address insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Fehler beim Speichern' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newAddress.id,
        label: newAddress.label,
        name: newAddress.name,
        street: newAddress.street,
        zip: newAddress.zip,
        city: newAddress.city,
        isDefault: newAddress.is_default
      }
    });
  } catch (error) {
    console.error('Addresses POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}

// PUT /api/auth/addresses - Update address
export async function PUT(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Nicht angemeldet' },
        { status: 401 }
      );
    }

    const { id, label, name, street, zip, city, isDefault } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Adress-ID fehlt' },
        { status: 400 }
      );
    }

    const supabase = await createAdminSupabaseClient();

    // Get user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single();

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', dbUser.id);
    }

    // Update address (only if belongs to user)
    const { error: updateError } = await supabase
      .from('addresses')
      .update({
        label,
        name,
        street,
        zip,
        city,
        is_default: isDefault || false
      })
      .eq('id', id)
      .eq('user_id', dbUser.id);

    if (updateError) {
      console.error('Address update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Fehler beim Speichern' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Addresses PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/addresses - Delete address
export async function DELETE(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Nicht angemeldet' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Adress-ID fehlt' },
        { status: 400 }
      );
    }

    const supabase = await createAdminSupabaseClient();

    // Get user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email.toLowerCase())
      .single();

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'Benutzer nicht gefunden' },
        { status: 404 }
      );
    }

    // Delete address (only if belongs to user)
    const { error: deleteError } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', dbUser.id);

    if (deleteError) {
      console.error('Address delete error:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Fehler beim Löschen' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Addresses DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Serverfehler' },
      { status: 500 }
    );
  }
}
