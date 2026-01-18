import { NextRequest, NextResponse } from 'next/server';
import { getCompanySettings, updateCompanySettings } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CompanySettings } from '@/types';

export async function GET() {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getCompanySettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching company settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const updates: Partial<CompanySettings> = await request.json();
    
    const validKeys: (keyof CompanySettings)[] = [
      'name', 'legal_name',
      'address_street', 'address_zip', 'address_city', 'address_country',
      'ceo', 'ceo_title',
      'phone', 'email', 'support_email', 'order_email',
      'iban', 'bic', 'bank_name', 'payment_recipient',
      'vat_id', 'company_register', 'register_court', 'register_city',
      'domain', 'url', 'logo_url',
    ];
    
    const filteredUpdates: Partial<CompanySettings> = {};
    for (const key of validKeys) {
      if (key in updates && updates[key] !== undefined) {
        (filteredUpdates as any)[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    await updateCompanySettings(filteredUpdates);
    const newSettings = await getCompanySettings();

    return NextResponse.json({ success: true, data: newSettings });
  } catch (error) {
    console.error('Error updating company settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
