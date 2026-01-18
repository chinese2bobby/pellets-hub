// Direct email sender - bypasses slow preview endpoint
import { readFileSync } from 'fs';
import { Resend } from 'resend';

// Load .env.local
const envFile = readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const resend = new Resend(env.RESEND_API_KEY);
const TO_EMAIL = 'vielgluck2sie@proton.me';
const FROM_EMAIL = env.RESEND_FROM_EMAIL || 'bestellung@pelletor.at';
const FROM_NAME = 'Pelletor';

// Company config
const COMPANY = {
  name: 'Pelletor',
  legal_name: 'Or Projekt GmbH',
  address: { street: 'Fördepromenade 2', zip: '24944', city: 'Flensburg' },
  phone: '+49 157 89812544',
  email: 'kundenservice@pelletor.at',
  iban: 'DE89 2175 0000 0017 2838 00',
  bic: 'NOLADE21NOS',
  bank_name: 'Nord-Ostsee Sparkasse',
  payment_recipient: 'Or Projekt GmbH',
};

// Colors
const C = {
  textPrimary: '#333333',
  textSecondary: '#555555',
  textMuted: '#666666',
  border: '#e0e0e0',
  backgroundLight: '#fafafa',
  backgroundMuted: '#f5f5f5',
  headerDark: '#2D5016',
  accentLight: '#a3c48a',
  accent: '#2D5016',
};

interface MockOrder {
  order_no: string;
  customer_name: string;
  salutation: string;
  email: string;
  phone: string;
  company_name?: string;
  vat_id?: string;
  country: 'DE' | 'AT';
  payment_method: string;
  order_type: 'order' | 'preorder';
  delivery_address: { street: string; house_no: string; zip: string; city: string };
  delivery_date?: string;
  delivery_notes?: string;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unit: string;
    line_total_net: number;
  }>;
  totals: {
    subtotal_net: number;
    shipping_net: number;
    vat_rate: number;
    vat_label: string;
    vat_amount: number;
    total_gross: number;
    is_reverse_charge: boolean;
  };
  created_at: string;
}

// Format currency
function formatCurrency(cents: number, country: string): string {
  const amount = cents / 100;
  return new Intl.NumberFormat(country === 'AT' ? 'de-AT' : 'de-DE', {
    style: 'currency', currency: 'EUR'
  }).format(amount);
}

// Generate mock orders
function createMockOrder(type: string, payment: string): MockOrder {
  const isAT = type.startsWith('at');
  const isB2B = type.includes('b2b');
  const isRC = type.includes('rc');

  const basePrice = 29900; // €299 net per palette
  const quantity = 2;
  const subtotalNet = basePrice * quantity;
  const vatRate = isAT ? 0.20 : 0.07;
  const vatAmount = isRC ? 0 : Math.round(subtotalNet * vatRate);
  const totalGross = subtotalNet + vatAmount;

  return {
    order_no: '300-042',
    customer_name: isB2B ? 'Thomas Weber' : 'Maria Schneider',
    salutation: isB2B ? 'herr' : 'frau',
    email: TO_EMAIL,
    phone: isAT ? '+43 660 123 4567' : '+49 170 123 4567',
    company_name: isB2B ? 'Weber Holzhandel GmbH' : undefined,
    vat_id: isRC ? 'ATU12345678' : undefined,
    country: isAT ? 'AT' : 'DE',
    payment_method: payment,
    order_type: 'order',
    delivery_address: {
      street: isAT ? 'Hauptstraße' : 'Musterstraße',
      house_no: '42',
      zip: isAT ? '1010' : '10115',
      city: isAT ? 'Wien' : 'Berlin',
    },
    delivery_date: '2025-01-20',
    items: [{
      name: 'Premium Pellets auf Palette (65 Säcke à 15kg)',
      sku: 'PREM-SACK',
      quantity,
      unit: 'palette',
      line_total_net: subtotalNet,
    }],
    totals: {
      subtotal_net: subtotalNet,
      shipping_net: 0,
      vat_rate: vatRate,
      vat_label: isAT ? 'USt.' : 'MwSt.',
      vat_amount: vatAmount,
      total_gross: totalGross,
      is_reverse_charge: isRC,
    },
    created_at: new Date().toISOString(),
  };
}

// Salutation
function getSalutation(order: MockOrder): string {
  const lastName = order.customer_name.split(' ').slice(-1)[0];
  if (order.salutation === 'herr') return `Sehr geehrter Herr ${lastName}`;
  if (order.salutation === 'frau') return `Sehr geehrte Frau ${lastName}`;
  return `Guten Tag`;
}

// Order info block
function getOrderInfoBlock(order: MockOrder): string {
  const orderDate = new Date(order.created_at).toLocaleDateString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const paymentLabels: Record<string, string> = {
    'vorkasse': 'Vorkasse (Banküberweisung)',
    'rechnung': 'Rechnung (50% Anzahlung)',
    'klarna': 'Klarna',
    'paypal': 'PayPal',
  };

  const itemsRows = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid ${C.border}; color: ${C.textPrimary};">
        <strong>${item.name}</strong><br>
        <span style="color: ${C.textMuted}; font-size: 12px;">Art.-Nr: ${item.sku}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid ${C.border}; text-align: center; color: ${C.textSecondary};">
        ${item.quantity} Palette(n)
      </td>
      <td style="padding: 12px; border-bottom: 1px solid ${C.border}; text-align: right; color: ${C.textPrimary}; font-weight: 600;">
        ${formatCurrency(item.line_total_net, order.country)}
      </td>
    </tr>
  `).join('');

  return `
    <div style="margin: 32px 0; border: 1px solid ${C.border};">
      <div style="background: ${C.backgroundLight}; padding: 16px 20px; border-bottom: 1px solid ${C.border};">
        <div style="font-weight: 600; color: ${C.textPrimary}; font-size: 14px; text-transform: uppercase;">Bestellübersicht</div>
      </div>
      <div style="padding: 20px;">
        <table width="100%" style="font-size: 14px;">
          <tr><td style="padding: 8px 0; color: ${C.textMuted}; width: 140px;">Bestellnummer</td><td style="padding: 8px 0; color: ${C.textPrimary}; font-weight: 600;">${order.order_no}</td></tr>
          <tr><td style="padding: 8px 0; color: ${C.textMuted};">Bestelldatum</td><td style="padding: 8px 0; color: ${C.textPrimary};">${orderDate}</td></tr>
          <tr><td style="padding: 8px 0; color: ${C.textMuted};">Zahlungsart</td><td style="padding: 8px 0; color: ${C.textPrimary};">${paymentLabels[order.payment_method] || order.payment_method}</td></tr>
        </table>
      </div>

      <div style="background: ${C.backgroundLight}; padding: 16px 20px; border-bottom: 1px solid ${C.border}; border-top: 1px solid ${C.border};">
        <div style="font-weight: 600; color: ${C.textPrimary}; font-size: 14px; text-transform: uppercase;">Produkte</div>
      </div>
      <table width="100%" style="font-size: 14px;">
        <thead>
          <tr style="background: ${C.backgroundMuted};">
            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid ${C.border};">Produkt</th>
            <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid ${C.border};">Menge</th>
            <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid ${C.border};">Netto</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div style="padding: 16px 20px; background: ${C.backgroundLight}; border-top: 1px solid ${C.border};">
        <table width="100%" style="font-size: 14px;">
          <tr><td style="color: ${C.textMuted};">Zwischensumme (netto)</td><td style="text-align: right; color: ${C.textSecondary};">${formatCurrency(order.totals.subtotal_net, order.country)}</td></tr>
          <tr><td style="color: ${C.textMuted};">${order.totals.is_reverse_charge ? 'USt. (Reverse Charge)' : `${order.totals.vat_label} (${(order.totals.vat_rate * 100).toFixed(0)}%)`}</td><td style="text-align: right; color: ${C.textSecondary};">${order.totals.is_reverse_charge ? '0,00 €' : formatCurrency(order.totals.vat_amount, order.country)}</td></tr>
          <tr><td colspan="2" style="padding: 8px 0;"><div style="border-top: 2px solid ${C.accent};"></div></td></tr>
          <tr><td style="font-weight: 700; font-size: 16px;">Gesamtbetrag</td><td style="text-align: right; color: ${C.accent}; font-weight: 700; font-size: 18px;">${formatCurrency(order.totals.total_gross, order.country)}</td></tr>
        </table>
        ${order.totals.is_reverse_charge ? `<div style="margin-top: 12px; font-size: 11px; color: ${C.textMuted};">Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).</div>` : ''}
      </div>

      <div style="background: ${C.backgroundLight}; padding: 16px 20px; border-bottom: 1px solid ${C.border}; border-top: 1px solid ${C.border};">
        <div style="font-weight: 600; color: ${C.textPrimary}; font-size: 14px; text-transform: uppercase;">Lieferadresse</div>
      </div>
      <div style="padding: 20px; font-size: 14px; line-height: 1.7;">
        <strong>${order.customer_name}</strong><br>
        ${order.company_name ? `${order.company_name}<br>` : ''}
        ${order.delivery_address.street} ${order.delivery_address.house_no}<br>
        ${order.delivery_address.zip} ${order.delivery_address.city}<br>
        ${order.country === 'AT' ? 'Österreich' : 'Deutschland'}
      </div>
    </div>
  `;
}

// Payment block
function getPaymentBlock(order: MockOrder): string {
  const total = order.totals.total_gross;
  const discount2 = Math.round(total * 0.02);
  const discount10 = Math.round(total * 0.10);
  const halfAmount = Math.round(total / 2);

  const bankTable = `
    <table width="100%" style="margin: 16px 0; border-collapse: collapse;">
      <tr><td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; width: 160px; font-size: 13px;">Kontoinhaber</td><td style="padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 13px;">${COMPANY.payment_recipient}</td></tr>
      <tr><td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; font-size: 13px;">IBAN</td><td style="padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 13px; font-family: monospace;">${COMPANY.iban}</td></tr>
      <tr><td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; font-size: 13px;">BIC</td><td style="padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 13px; font-family: monospace;">${COMPANY.bic}</td></tr>
      <tr><td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; font-size: 13px;">Bank</td><td style="padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 13px;">${COMPANY.bank_name}</td></tr>
      <tr><td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; font-size: 13px;">Verwendungszweck</td><td style="padding: 10px 12px; border: 1px solid #e0e0e0; font-size: 13px; font-weight: 600;">${order.order_no}</td></tr>
    </table>`;

  const qrPlaceholder = `
    <div style="text-align: center; margin: 24px 0; padding: 20px; background: #fafafa; border: 1px solid #e5e5e5;">
      <div style="width: 120px; height: 120px; margin: 0 auto; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc;">
        <span style="color: #999; font-size: 11px;">QR-CODE</span>
      </div>
      <p style="margin: 12px 0 0; color: #666; font-size: 12px;">Scannen Sie den QR-Code mit Ihrer Banking-App.</p>
    </div>`;

  if (order.payment_method === 'vorkasse') {
    return `
      <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 32px;">
        <h3 style="margin: 0 0 20px; font-size: 16px; font-weight: 600;">Zahlungsinformationen – Vorkasse</h3>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0;">
          <div style="color: #6b7280; font-size: 13px;">Zu zahlender Betrag</div>
          <div style="font-size: 28px; font-weight: 700; padding: 8px 0;">${formatCurrency(total, order.country)}</div>
        </div>
        ${bankTable}
        ${qrPlaceholder}
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #166534; font-size: 14px;">2% Skonto bei Sofortüberweisung</p>
          <p style="margin: 0; color: #15803d; font-size: 14px;">Bei Zahlung innerhalb 3 Werktagen: ${formatCurrency(total - discount2, order.country)} statt ${formatCurrency(total, order.country)}</p>
        </div>
      </div>`;
  }

  if (order.payment_method === 'rechnung') {
    return `
      <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 32px;">
        <h3 style="margin: 0 0 20px; font-size: 16px; font-weight: 600;">Zahlungsinformationen – Rechnung (50% Anzahlung)</h3>
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 0 0 24px;">
          <p style="margin: 0 0 12px; font-weight: 600; color: #92400e;">Hinweis zur Zahlungsfreigabe</p>
          <p style="margin: 0; color: #78350f; font-size: 14px;">Die Bonitätsprüfung konnte nicht bestätigt werden. Daher ist eine <strong>Anzahlung von 50%</strong> erforderlich. Restbetrag bei Lieferung.</p>
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0;">
          <table width="100%">
            <tr><td style="color: #6b7280; font-size: 13px;">Gesamtbetrag</td><td style="text-align: right;">${formatCurrency(total, order.country)}</td></tr>
            <tr><td colspan="2" style="padding: 8px 0;"><div style="border-top: 1px solid #e5e7eb;"></div></td></tr>
            <tr><td style="font-weight: 600;">Anzahlung (50%)</td><td style="text-align: right; font-size: 24px; font-weight: 700;">${formatCurrency(halfAmount, order.country)}</td></tr>
            <tr><td style="color: #6b7280; font-size: 13px;">Restzahlung bei Lieferung</td><td style="text-align: right;">${formatCurrency(halfAmount, order.country)}</td></tr>
          </table>
        </div>
        ${bankTable}
        ${qrPlaceholder}
      </div>`;
  }

  if (order.payment_method === 'klarna' || order.payment_method === 'paypal') {
    const name = order.payment_method === 'klarna' ? 'Klarna' : 'PayPal';
    return `
      <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 32px;">
        <h3 style="margin: 0 0 20px; font-size: 16px; font-weight: 600;">Zahlungsinformationen – ${name} nicht verfügbar</h3>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 0 0 24px;">
          <p style="margin: 0 0 12px; font-weight: 600; color: #991b1b;">Hinweis zur Zahlungsart ${name}</p>
          <p style="margin: 0; color: #7f1d1d; font-size: 14px;">${name} steht für diese Bestellung nicht zur Verfügung. Als Entschädigung: <strong>10% Rabatt</strong> bei Banküberweisung.</p>
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0;">
          <table width="100%">
            <tr><td style="color: #6b7280;">Ursprünglicher Betrag</td><td style="text-align: right; text-decoration: line-through;">${formatCurrency(total, order.country)}</td></tr>
            <tr><td style="color: #6b7280;">Rabatt (10%)</td><td style="text-align: right; color: #16a34a;">- ${formatCurrency(discount10, order.country)}</td></tr>
            <tr><td colspan="2" style="padding: 8px 0;"><div style="border-top: 1px solid #e5e7eb;"></div></td></tr>
            <tr><td style="font-weight: 600;">Zu zahlender Betrag</td><td style="text-align: right; font-size: 24px; font-weight: 700;">${formatCurrency(total - discount10, order.country)}</td></tr>
          </table>
        </div>
        ${bankTable}
        ${qrPlaceholder}
      </div>`;
  }

  return '';
}

// Generate full email HTML
function generateEmail(order: MockOrder, type: 'confirmation' | 'weekend_hello'): string {
  const salutation = getSalutation(order);
  const orderInfo = getOrderInfoBlock(order);
  const paymentBlock = type === 'confirmation' ? getPaymentBlock(order) : '';

  const title = type === 'weekend_hello' ? 'Eingangsbestätigung' : 'Bestellbestätigung';
  const intro = type === 'weekend_hello'
    ? `vielen Dank für Ihre Bestellung bei ${COMPANY.name}.<br><br>Wir haben Ihre Bestellung erhalten und werden sie am nächsten Werktag bearbeiten.`
    : `vielen Dank für Ihre Bestellung und Ihr Vertrauen in ${COMPANY.name}.<br>Ihre Bestellung wurde an unsere Logistikabteilung weitergeleitet.`;

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin: 0; padding: 0; background-color: ${C.backgroundMuted}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" style="background-color: ${C.backgroundMuted};">
    <tr><td align="center" style="padding: 40px 20px;">
      <table width="600" style="max-width: 600px; width: 100%;">
        <tr><td style="background: ${C.headerDark}; padding: 24px 40px;">
          <div style="font-size: 20px; font-weight: 600; color: white;">${COMPANY.name}</div>
          <div style="font-size: 13px; color: ${C.accentLight}; margin-top: 4px;">${title}</div>
        </td></tr>
        <tr><td style="background: white; padding: 40px; border: 1px solid ${C.border}; border-top: none;">
          <p style="margin: 0 0 20px; font-size: 15px;">${salutation},</p>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: ${C.textSecondary};">${intro}</p>
          ${orderInfo}
          ${paymentBlock}
          <p style="margin: 24px 0 0; font-size: 14px; color: ${C.textSecondary};">Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>
          <p style="margin: 24px 0 0; font-size: 14px;">Mit freundlichen Grüßen<br>${COMPANY.name}</p>
        </td></tr>
        <tr><td style="background: ${C.backgroundMuted}; padding: 24px 40px; text-align: center; border: 1px solid ${C.border}; border-top: none;">
          <div style="color: ${C.textMuted}; font-size: 12px; line-height: 1.8;">
            ${COMPANY.legal_name}<br>
            ${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}<br>
            ${COMPANY.email} | ${COMPANY.phone}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(subject: string, html: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      subject,
      html,
    });
    if (error) {
      console.error(`❌ ${subject}:`, error.message);
      return false;
    }
    console.log(`✅ ${subject}`);
    return true;
  } catch (err) {
    console.error(`❌ ${subject}:`, err);
    return false;
  }
}

async function main() {
  console.log(`📧 Отправка писем на: ${TO_EMAIL}\n`);

  const variations = [
    { type: 'de-b2c', payment: 'vorkasse', label: 'DE B2C – VORKASSE' },
    { type: 'de-b2c', payment: 'rechnung', label: 'DE B2C – RECHNUNG (50%)' },
    { type: 'de-b2c', payment: 'klarna', label: 'DE B2C – KLARNA (недоступен)' },
    { type: 'de-b2c', payment: 'paypal', label: 'DE B2C – PAYPAL (недоступен)' },
    { type: 'de-b2b', payment: 'vorkasse', label: 'DE B2B – VORKASSE' },
    { type: 'at-b2c', payment: 'vorkasse', label: 'AT B2C – VORKASSE' },
    { type: 'at-b2b-rc', payment: 'vorkasse', label: 'AT B2B (Reverse Charge)' },
  ];

  let sent = 0;
  for (const v of variations) {
    const order = createMockOrder(v.type, v.payment);
    const html = generateEmail(order, 'confirmation');
    if (await sendEmail(`[Pelletor] ${v.label}`, html)) sent++;
    await new Promise(r => setTimeout(r, 600));
  }

  // Weekend hello
  const weekendOrder = createMockOrder('de-b2c', 'vorkasse');
  const weekendHtml = generateEmail(weekendOrder, 'weekend_hello');
  if (await sendEmail(`[Pelletor] Eingangsbestätigung (Wochenende)`, weekendHtml)) sent++;

  console.log(`\n✅ Отправлено: ${sent}/8 писем`);
}

main().catch(console.error);
