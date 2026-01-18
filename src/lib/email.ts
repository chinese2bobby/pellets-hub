// Resend Email Integration
import { Resend } from 'resend';
import { Order, EmailType, CompanySettings } from '@/types';
import { formatCurrency, getEpcQrCodeUrl } from './utils';
import { COUNTRY_CONFIG } from '@/config';
import { getCompanySettings } from './db';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'bestellung@pelletor.at';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Pelletor';

const WAREHOUSE_HINWEIS = (settings: CompanySettings) => `
<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
  <p style="margin: 0 0 8px; font-weight: 600; color: #92400e; font-size: 14px;">📦 Hinweis zum Zahlungsempfänger</p>
  <p style="margin: 0; color: #78350f; font-size: 13px; line-height: 1.6;">
    Aufgrund des aktuell sehr hohen Bestellaufkommens wird Ihre Lieferung aus einem unserer externen Lager abgewickelt. 
    Die Zahlung geht daher direkt auf das Konto unseres zweiten Lagerstandortes ein.<br><br>
    Bitte beachten Sie, dass der Kontoinhaber in diesem Fall <strong>${settings.payment_recipient}</strong> lautet. 
    Selbstverständlich bleibt Ihre Bestellung vollständig bei ${settings.legal_name} registriert und abgesichert.
  </p>
</div>`;

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================
// EMAIL STYLING
// ============================================

// Common email font stack - TASA Orbiter with system fallbacks
const EMAIL_FONT_STACK = "'TASA Orbiter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// Subdued color palette for professional emails
const EMAIL_COLORS = {
  textPrimary: '#333333',
  textSecondary: '#555555',
  textMuted: '#666666',
  textLight: '#888888',
  border: '#e0e0e0',
  borderLight: '#e5e5e5',
  backgroundLight: '#fafafa',
  backgroundMuted: '#f5f5f5',
  headerDark: '#2D5016',
  headerLight: '#1a3409',
  accent: '#2D5016',
  accentLight: '#a3c48a',
};

// ============================================
// HELPERS
// ============================================

// Helper: Get proper German salutation
function getSalutation(order: Order): string {
  const lastName = order.customer_name.split(' ').slice(-1)[0];
  const firstName = order.customer_name.split(' ')[0];

  switch (order.salutation) {
    case 'herr':
      return `Sehr geehrter Herr ${lastName}`;
    case 'frau':
      return `Sehr geehrte Frau ${lastName}`;
    case 'firma':
      return order.company_name
        ? `Sehr geehrte Damen und Herren`
        : `Guten Tag ${firstName}`;
    case 'divers':
      return `Guten Tag ${firstName}`;
    default:
      return `Guten Tag ${firstName}`;
  }
}

// Helper: Format date in German
function formatDateDE(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('de-AT', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// Helper: Get payment method label
function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    'vorkasse': 'Vorkasse (Banküberweisung)',
    'rechnung': 'Rechnung',
    'klarna': 'Klarna',
    'paypal': 'PayPal',
    'lastschrift': 'SEPA-Lastschrift',
  };
  return labels[method] || method;
}

// Helper: Generate full order info block for emails
function getOrderInfoBlockHtml(order: Order): string {
  const orderDate = new Date(order.created_at).toLocaleDateString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // Items table
  const itemsRows = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid ${EMAIL_COLORS.border}; color: ${EMAIL_COLORS.textPrimary};">
        <strong>${item.name}</strong><br>
        <span style="color: ${EMAIL_COLORS.textMuted}; font-size: 12px;">Art.-Nr: ${item.sku}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid ${EMAIL_COLORS.border}; text-align: center; color: ${EMAIL_COLORS.textSecondary};">
        ${item.quantity} ${item.unit === 'palette' ? 'Palette(n)' : item.unit === 'kg' ? 'kg' : item.unit}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid ${EMAIL_COLORS.border}; text-align: right; color: ${EMAIL_COLORS.textPrimary}; font-weight: 600;">
        ${formatCurrency(item.line_total_net, order.country)}
      </td>
    </tr>
  `).join('');

  return `
    <!-- Full Order Information Block -->
    <div style="margin: 32px 0; border: 1px solid ${EMAIL_COLORS.border};">

      <!-- Section: Bestellübersicht -->
      <div style="background: ${EMAIL_COLORS.backgroundLight}; padding: 16px 20px; border-bottom: 1px solid ${EMAIL_COLORS.border};">
        <div style="font-weight: 600; color: ${EMAIL_COLORS.textPrimary}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Bestellübersicht</div>
      </div>

      <div style="padding: 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: ${EMAIL_COLORS.textMuted}; width: 140px;">Bestellnummer</td>
            <td style="padding: 8px 0; color: ${EMAIL_COLORS.textPrimary}; font-weight: 600;">${order.order_no}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: ${EMAIL_COLORS.textMuted};">Bestelldatum</td>
            <td style="padding: 8px 0; color: ${EMAIL_COLORS.textPrimary};">${orderDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: ${EMAIL_COLORS.textMuted};">Bestellart</td>
            <td style="padding: 8px 0; color: ${EMAIL_COLORS.textPrimary};">${order.order_type === 'preorder' ? 'Vorbestellung' : 'Sofortbestellung'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: ${EMAIL_COLORS.textMuted};">Zahlungsart</td>
            <td style="padding: 8px 0; color: ${EMAIL_COLORS.textPrimary};">${getPaymentMethodLabel(order.payment_method)}</td>
          </tr>
        </table>
      </div>

      <!-- Section: Produkte -->
      <div style="background: ${EMAIL_COLORS.backgroundLight}; padding: 16px 20px; border-bottom: 1px solid ${EMAIL_COLORS.border}; border-top: 1px solid ${EMAIL_COLORS.border};">
        <div style="font-weight: 600; color: ${EMAIL_COLORS.textPrimary}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Bestellte Produkte</div>
      </div>

      <div style="padding: 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
          <thead>
            <tr style="background: ${EMAIL_COLORS.backgroundMuted};">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: ${EMAIL_COLORS.textSecondary}; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid ${EMAIL_COLORS.border};">Produkt</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: ${EMAIL_COLORS.textSecondary}; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid ${EMAIL_COLORS.border};">Menge</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: ${EMAIL_COLORS.textSecondary}; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid ${EMAIL_COLORS.border};">Netto</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="padding: 16px 20px; background: ${EMAIL_COLORS.backgroundLight}; border-top: 1px solid ${EMAIL_COLORS.border};">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: ${EMAIL_COLORS.textMuted};">Zwischensumme (netto)</td>
              <td style="padding: 4px 0; text-align: right; color: ${EMAIL_COLORS.textSecondary};">${formatCurrency(order.totals.subtotal_net, order.country)}</td>
            </tr>
            ${order.totals.shipping_net > 0 ? `
            <tr>
              <td style="padding: 4px 0; color: ${EMAIL_COLORS.textMuted};">Versandkosten</td>
              <td style="padding: 4px 0; text-align: right; color: ${EMAIL_COLORS.textSecondary};">${formatCurrency(order.totals.shipping_net, order.country)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 4px 0; color: ${EMAIL_COLORS.textMuted};">${order.totals.is_reverse_charge ? 'USt. (Reverse Charge)' : `${order.totals.vat_label} (${(order.totals.vat_rate * 100).toFixed(0)}%)`}</td>
              <td style="padding: 4px 0; text-align: right; color: ${EMAIL_COLORS.textSecondary};">${order.totals.is_reverse_charge ? '0,00 EUR' : formatCurrency(order.totals.vat_amount, order.country)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 8px 0;"><div style="border-top: 2px solid ${EMAIL_COLORS.accent};"></div></td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: ${EMAIL_COLORS.textPrimary}; font-weight: 700; font-size: 16px;">Gesamtbetrag</td>
              <td style="padding: 4px 0; text-align: right; color: ${EMAIL_COLORS.accent}; font-weight: 700; font-size: 18px;">${formatCurrency(order.totals.total_gross, order.country)}</td>
            </tr>
          </table>
          ${order.totals.is_reverse_charge ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid ${EMAIL_COLORS.border}; font-size: 11px; color: ${EMAIL_COLORS.textMuted};">
            Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge gem. Art. 196 MwStSystRL).
            ${order.vat_id ? `<br>UID-Nr.: ${order.vat_id}` : ''}
          </div>
          ` : ''}
        </div>
      </div>

      <!-- Section: Lieferadresse -->
      <div style="background: ${EMAIL_COLORS.backgroundLight}; padding: 16px 20px; border-bottom: 1px solid ${EMAIL_COLORS.border}; border-top: 1px solid ${EMAIL_COLORS.border};">
        <div style="font-weight: 600; color: ${EMAIL_COLORS.textPrimary}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Lieferadresse</div>
      </div>

      <div style="padding: 20px;">
        <div style="color: ${EMAIL_COLORS.textPrimary}; font-size: 14px; line-height: 1.7;">
          <strong>${order.customer_name}</strong><br>
          ${order.company_name ? `${order.company_name}<br>` : ''}
          ${order.delivery_address.street} ${order.delivery_address.house_no || ''}<br>
          ${order.delivery_address.zip} ${order.delivery_address.city}<br>
          ${order.country === 'AT' ? 'Österreich' : 'Deutschland'}
        </div>
        ${order.delivery_date ? `
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid ${EMAIL_COLORS.border};">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: ${EMAIL_COLORS.textMuted}; width: 140px;">Wunschtermin</td>
              <td style="padding: 4px 0; color: ${EMAIL_COLORS.textPrimary};">${formatDateDE(order.delivery_date)}</td>
            </tr>
            ${order.delivery_window ? `
            <tr>
              <td style="padding: 4px 0; color: ${EMAIL_COLORS.textMuted};">Zeitfenster</td>
              <td style="padding: 4px 0; color: ${EMAIL_COLORS.textPrimary};">${order.delivery_window}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        ` : ''}
        ${order.delivery_notes ? `
        <div style="margin-top: 16px; padding: 12px; background: ${EMAIL_COLORS.backgroundMuted}; border-left: 3px solid ${EMAIL_COLORS.textMuted};">
          <div style="color: ${EMAIL_COLORS.textMuted}; font-size: 12px; margin-bottom: 4px;">Lieferhinweise:</div>
          <div style="color: ${EMAIL_COLORS.textSecondary}; font-size: 13px;">${order.delivery_notes}</div>
        </div>
        ` : ''}
      </div>

      <!-- Section: Kontaktdaten -->
      <div style="background: ${EMAIL_COLORS.backgroundLight}; padding: 16px 20px; border-bottom: 1px solid ${EMAIL_COLORS.border}; border-top: 1px solid ${EMAIL_COLORS.border};">
        <div style="font-weight: 600; color: ${EMAIL_COLORS.textPrimary}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Ihre Kontaktdaten</div>
      </div>

      <div style="padding: 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textMuted}; width: 140px;">Name</td>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textPrimary};">${order.customer_name}</td>
          </tr>
          ${order.company_name ? `
          <tr>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textMuted};">Firma</td>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textPrimary};">${order.company_name}</td>
          </tr>
          ` : ''}
          ${order.vat_id ? `
          <tr>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textMuted};">USt-IdNr.</td>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textPrimary};">${order.vat_id}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textMuted};">E-Mail</td>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textPrimary};">${order.email}</td>
          </tr>
          ${order.phone ? `
          <tr>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textMuted};">Telefon</td>
            <td style="padding: 6px 0; color: ${EMAIL_COLORS.textPrimary};">${order.phone}</td>
          </tr>
          ` : ''}
        </table>
      </div>

    </div>
  `;
}

// ============================================
// EMAIL TEMPLATES
// ============================================

function getWeekendHelloEmail(order: Order, s: CompanySettings): { subject: string; html: string } {
  const salutation = getSalutation(order);
  const orderInfoBlock = getOrderInfoBlockHtml(order);

  return {
    subject: `Eingangsbestätigung – Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eingangsbestätigung ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.backgroundMuted}; font-family: ${EMAIL_FONT_STACK};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${EMAIL_COLORS.backgroundMuted};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: ${EMAIL_COLORS.headerDark}; padding: 24px 30px; border-radius: 8px 8px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <img src="${s.logo_url}" alt="${s.name}" style="height: 44px; width: auto; display: block;" />
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Eingangsbestätigung</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background: white; padding: 40px; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <p style="margin: 0 0 20px; font-size: 15px; color: ${EMAIL_COLORS.textPrimary};">${salutation},</p>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                vielen Dank für Ihre Bestellung bei ${s.name}.
              </p>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                Wir haben Ihre Bestellung erhalten und werden sie am nächsten Werktag bearbeiten.
                Sie erhalten in Kürze eine ausführliche Bestellbestätigung mit allen weiteren Informationen.
              </p>

              <!-- Full Order Info -->
              ${orderInfoBlock}

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                Bei Fragen stehen wir Ihnen selbstverständlich jederzeit zur Verfügung.
              </p>

              <p style="margin: 24px 0 0; font-size: 14px; color: ${EMAIL_COLORS.textPrimary};">
                Mit freundlichen Grüßen<br>
                ${s.name}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: ${EMAIL_COLORS.backgroundMuted}; padding: 24px 40px; text-align: center; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <div style="color: ${EMAIL_COLORS.textMuted}; font-size: 12px; line-height: 1.8;">
                ${s.legal_name}<br>
                ${s.address_street}, ${s.address_zip} ${s.address_city}<br>
                ${s.email} | ${s.phone}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

function getPaymentBlockHtml(order: Order, s: CompanySettings): string {
  const totalGross = order.totals.total_gross;
  const paymentMethod = order.payment_method;

  const discount2Percent = Math.round(totalGross * 0.02);
  const discount10Percent = Math.round(totalGross * 0.10);
  const amountWith2PercentDiscount = totalGross - discount2Percent;
  const amountWith10PercentDiscount = totalGross - discount10Percent;
  const halfAmount = Math.round(totalGross / 2);

  const getQrCodeHtml = (amountCents: number, reference: string) => {
    const qrUrl = getEpcQrCodeUrl(amountCents, reference, {
      iban: s.iban,
      bic: s.bic,
      payment_recipient: s.payment_recipient,
    });
    return `
    <div style="text-align: center; margin: 24px 0; padding: 20px; background: #fafafa; border: 1px solid #e5e5e5;">
      <img src="${qrUrl}" alt="EPC QR-Code für Banküberweisung" style="width: 160px; height: 160px; margin: 0 auto; display: block;" />
      <p style="margin: 12px 0 0; color: #666; font-size: 12px;">
        Scannen Sie den QR-Code in Ihrer Banking-App
      </p>
    </div>`;
  };

  const bankDetailsTable = `
    ${WAREHOUSE_HINWEIS(s)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; width: 160px; color: #555; font-size: 13px;">Kontoinhaber</td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333; font-size: 13px;">${s.payment_recipient}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; color: #555; font-size: 13px;">IBAN</td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333; font-size: 13px; font-family: 'Courier New', monospace;">${s.iban}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; color: #555; font-size: 13px;">BIC</td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333; font-size: 13px; font-family: 'Courier New', monospace;">${s.bic}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; color: #555; font-size: 13px;">Kreditinstitut</td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333; font-size: 13px;">${s.bank_name}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; background: #fafafa; color: #555; font-size: 13px;">Verwendungszweck</td>
        <td style="padding: 10px 12px; border: 1px solid #e0e0e0; color: #333; font-size: 13px; font-weight: 600;">${order.order_no}</td>
      </tr>
    </table>`;

  // VORKASSE - Full prepayment
  if (paymentMethod === 'vorkasse') {
    return `
      <!-- Payment Section: Vorkasse -->
      <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 32px;">
        <h3 style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #1f2937;">Zahlungsinformationen</h3>

        <p style="margin: 0 0 20px; color: #374151; font-size: 14px; line-height: 1.7;">
          Sie haben Vorkasse als Zahlungsart gewählt. Nachfolgend finden Sie die Bankverbindung für Ihre Überweisung.
        </p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="color: #6b7280; font-size: 13px;">Zu zahlender Betrag</td>
            </tr>
            <tr>
              <td style="font-size: 28px; font-weight: 700; color: #1f2937; padding: 8px 0;">${formatCurrency(totalGross, order.country)}</td>
            </tr>
          </table>
        </div>

        ${bankDetailsTable}

        ${getQrCodeHtml(totalGross, order.order_no)}

        <p style="margin: 20px 0; color: #374151; font-size: 14px; line-height: 1.7;">
          Für eine zügige Bearbeitung bitten wir Sie, die Überweisung innerhalb von 72 Stunden vorzunehmen.
          Selbstverständlich akzeptieren wir auch reguläre SEPA-Überweisungen mit einer Bearbeitungszeit von 1–3 Werktagen.
        </p>

        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #166534; font-size: 14px;">Hinweis: 2% Skonto bei schneller Zahlung</p>
          <p style="margin: 0; color: #15803d; font-size: 14px; line-height: 1.6;">
            Bei Zahlungseingang innerhalb von 3 Werktagen gewähren wir Ihnen 2% Skonto auf den Gesamtbetrag.
            In diesem Fall überweisen Sie bitte ${formatCurrency(amountWith2PercentDiscount, order.country)} anstelle von ${formatCurrency(totalGross, order.country)}.
          </p>
        </div>

        <p style="margin: 20px 0 0; color: #374151; font-size: 14px; line-height: 1.7;">
          Bitte geben Sie unbedingt die Bestellnummer <strong>${order.order_no}</strong> als Verwendungszweck an,
          damit wir Ihre Zahlung korrekt zuordnen können. Nach Eingang der Zahlung setzen wir uns umgehend mit Ihnen
          in Verbindung, um die weiteren Schritte zur Lieferung zu besprechen.
        </p>
      </div>`;
  }

  // KLARNA, PAYPAL, LASTSCHRIFT - Payment method unavailable
  if (paymentMethod === 'klarna' || paymentMethod === 'paypal' || paymentMethod === 'lastschrift') {
    const methodName = paymentMethod === 'klarna' ? 'Klarna' : paymentMethod === 'paypal' ? 'PayPal' : 'Lastschrift';

    return `
      <!-- Payment Section: ${methodName} unavailable -->
      <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 32px;">
        <h3 style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #1f2937;">Zahlungsinformationen</h3>

        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 0 0 24px;">
          <p style="margin: 0 0 12px; font-weight: 600; color: #991b1b; font-size: 14px;">Hinweis zur Zahlungsart ${methodName}</p>
          <p style="margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.7;">
            Leider müssen wir Ihnen mitteilen, dass die Zahlungsabwicklung über ${methodName} für Ihre Bestellung
            derzeit nicht zur Verfügung steht. Dies kann verschiedene Gründe haben, die mit den internen
            Prüfmechanismen des Zahlungsdienstleisters zusammenhängen.
          </p>
          <p style="margin: 16px 0 0; color: #7f1d1d; font-size: 14px; line-height: 1.7;">
            Um Ihre Bestellung nicht zu gefährden, bieten wir Ihnen eine sichere Alternative an.
            Wir bitten diese Unannehmlichkeit zu entschuldigen.
          </p>
        </div>

        <p style="margin: 0 0 20px; color: #374151; font-size: 14px; line-height: 1.7;">
          Als Alternative bieten wir Ihnen die Zahlung per Banküberweisung an. Um Ihnen für die entstandenen
          Unannehmlichkeiten entgegenzukommen, gewähren wir Ihnen einen <strong>Rabatt von 10%</strong> auf den Gesamtbetrag.
        </p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="color: #6b7280; font-size: 13px;">Ursprünglicher Betrag</td>
              <td style="text-align: right; color: #6b7280; font-size: 14px; text-decoration: line-through;">${formatCurrency(totalGross, order.country)}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; font-size: 13px; padding-top: 8px;">Rabatt (10%)</td>
              <td style="text-align: right; color: #16a34a; font-size: 14px; padding-top: 8px;">- ${formatCurrency(discount10Percent, order.country)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 12px 0;"><div style="border-top: 1px solid #e5e7eb;"></div></td>
            </tr>
            <tr>
              <td style="color: #1f2937; font-size: 14px; font-weight: 600;">Zu zahlender Betrag</td>
              <td style="text-align: right; font-size: 24px; font-weight: 700; color: #1f2937;">${formatCurrency(amountWith10PercentDiscount, order.country)}</td>
            </tr>
          </table>
        </div>

        ${bankDetailsTable}

        ${getQrCodeHtml(amountWith10PercentDiscount, order.order_no)}

        <p style="margin: 20px 0; color: #374151; font-size: 14px; line-height: 1.7;">
          Bitte überweisen Sie den Betrag von <strong>${formatCurrency(amountWith10PercentDiscount, order.country)}</strong> unter Angabe
          der Bestellnummer <strong>${order.order_no}</strong> als Verwendungszweck.
        </p>

        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.7;">
          Nach Eingang der Zahlung werden wir Ihre Bestellung umgehend bearbeiten und Sie über den weiteren
          Verlauf der Lieferung informieren. Bei Fragen stehen wir Ihnen selbstverständlich jederzeit zur Verfügung.
        </p>
      </div>`;
  }

  // RECHNUNG - 50% deposit required
  if (paymentMethod === 'rechnung') {
    return `
      <!-- Payment Section: Rechnung (50% Anzahlung) -->
      <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 32px;">
        <h3 style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #1f2937;">Zahlungsinformationen</h3>

        <p style="margin: 0 0 20px; color: #374151; font-size: 14px; line-height: 1.7;">
          Sie haben Rechnung als Zahlungsart gewählt.
        </p>

        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 0 0 24px;">
          <p style="margin: 0 0 12px; font-weight: 600; color: #92400e; font-size: 14px;">Hinweis zur Zahlungsfreigabe</p>
          <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.7;">
            Bei der Zahlungsart „Rechnung" führt unser Zahlungsdienstleister eine automatisierte Prüfung durch.
            Leider konnte die Freigabe in diesem Fall nicht erteilt werden.
          </p>
          <p style="margin: 16px 0 0; color: #78350f; font-size: 14px; line-height: 1.7;">
            <strong>Daher ist eine Anzahlung von 50% erforderlich.</strong>
            Den Restbetrag zahlen Sie bequem bei Lieferung. Nach erfolgreicher Abwicklung steht Ihnen
            die Zahlung auf Rechnung ohne Anzahlung zur Verfügung.
          </p>
        </div>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="color: #6b7280; font-size: 13px;">Gesamtbetrag der Bestellung</td>
              <td style="text-align: right; color: #374151; font-size: 14px;">${formatCurrency(totalGross, order.country)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 12px 0;"><div style="border-top: 1px solid #e5e7eb;"></div></td>
            </tr>
            <tr>
              <td style="color: #1f2937; font-size: 14px; font-weight: 600;">Anzahlung (50%)</td>
              <td style="text-align: right; font-size: 24px; font-weight: 700; color: #1f2937;">${formatCurrency(halfAmount, order.country)}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; font-size: 13px; padding-top: 8px;">Restzahlung bei Lieferung</td>
              <td style="text-align: right; color: #374151; font-size: 14px; padding-top: 8px;">${formatCurrency(halfAmount, order.country)}</td>
            </tr>
          </table>
        </div>

        ${bankDetailsTable}

        ${getQrCodeHtml(halfAmount, order.order_no)}

        <p style="margin: 20px 0; color: #374151; font-size: 14px; line-height: 1.7;">
          Bitte überweisen Sie die Anzahlung von <strong>${formatCurrency(halfAmount, order.country)}</strong> innerhalb von
          72 Stunden unter Angabe der Bestellnummer <strong>${order.order_no}</strong> als Verwendungszweck,
          um eine zügige Bearbeitung Ihrer Bestellung zu gewährleisten.
        </p>

        <p style="margin: 0 0 20px; color: #374151; font-size: 14px; line-height: 1.7;">
          Nach Verbuchung des Zahlungseingangs erhalten Sie eine Bestätigung sowie die aktualisierte Rechnung
          mit dem verbleibenden Restbetrag.
        </p>

        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #166534; font-size: 14px;">Alternative Zahlungsmöglichkeiten</p>
          <p style="margin: 0; color: #15803d; font-size: 14px; line-height: 1.6;">
            Sollten Sie die vollständige Zahlung per Vorkasse bevorzugen, können Sie selbstverständlich auch
            den gesamten Betrag von ${formatCurrency(totalGross, order.country)} überweisen. In diesem Fall entfällt
            die Restzahlung bei Lieferung.
          </p>
        </div>
      </div>`;
  }

  return '';
}

function getConfirmationEmail(order: Order, s: CompanySettings): { subject: string; html: string } {
  const salutation = getSalutation(order);
  const orderInfoBlock = getOrderInfoBlockHtml(order);
  const paymentBlockHtml = getPaymentBlockHtml(order, s);

  return {
    subject: `Bestellbestätigung ${order.order_no} – ${s.name}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bestellbestätigung ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.backgroundMuted}; font-family: ${EMAIL_FONT_STACK};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${EMAIL_COLORS.backgroundMuted};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: ${EMAIL_COLORS.headerDark}; padding: 24px 30px; border-radius: 8px 8px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <img src="${s.logo_url}" alt="${s.name}" style="height: 44px; width: auto; display: block;" />
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Bestellbestätigung</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background: white; padding: 40px; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <p style="margin: 0 0 20px; font-size: 15px; color: ${EMAIL_COLORS.textPrimary};">${salutation},</p>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                vielen Dank für Ihre Bestellung und Ihr Vertrauen in ${s.name}.
                Wir haben Ihren Auftrag erhalten und werden ihn schnellstmöglich bearbeiten.
                Ihre Bestellung wurde bereits an unsere Logistikabteilung weitergeleitet.
              </p>

              <!-- Full Order Info Block -->
              ${orderInfoBlock}

              <!-- Payment Block (method-specific) -->
              ${paymentBlockHtml}

              <!-- Next Steps -->
              <div style="margin-top: 28px; padding: 20px; background: ${EMAIL_COLORS.backgroundLight}; border-left: 4px solid ${EMAIL_COLORS.accent};">
                <div style="font-weight: 600; color: ${EMAIL_COLORS.textPrimary}; margin-bottom: 8px; font-size: 14px;">Nächste Schritte</div>
                <div style="color: ${EMAIL_COLORS.textSecondary}; font-size: 14px; line-height: 1.6;">
                  ${order.payment_method === 'vorkasse' ? 'Nach Zahlungseingang wird Ihre Bestellung für den Versand vorbereitet.' :
                    order.payment_method === 'rechnung' ? 'Nach Eingang der Anzahlung wird Ihre Bestellung für den Versand vorbereitet.' :
                    'Wir informieren Sie per E-Mail über den Lieferstatus.'}
                  ${order.order_type === 'preorder' ? 'Bei Vorbestellungen kontaktieren wir Sie zur Terminabstimmung.' : ''}
                </div>
              </div>

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                Bei Fragen stehen wir Ihnen selbstverständlich jederzeit zur Verfügung.
              </p>

              <p style="margin: 24px 0 0; font-size: 14px; color: ${EMAIL_COLORS.textPrimary};">
                Mit freundlichen Grüßen<br>
                ${s.name}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: ${EMAIL_COLORS.backgroundMuted}; padding: 24px 40px; text-align: center; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <div style="color: ${EMAIL_COLORS.textMuted}; font-size: 12px; line-height: 1.8;">
                ${s.legal_name}<br>
                ${s.address_street}, ${s.address_zip} ${s.address_city}<br>
                ${s.email} | ${s.phone}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

function getPaymentInstructionsEmail(order: Order, s: CompanySettings): { subject: string; html: string } {
  const salutation = getSalutation(order);
  const orderInfoBlock = getOrderInfoBlockHtml(order);

  return {
    subject: `Zahlungsinformationen – Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zahlungsinformationen ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.backgroundMuted}; font-family: ${EMAIL_FONT_STACK};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${EMAIL_COLORS.backgroundMuted};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: ${EMAIL_COLORS.headerDark}; padding: 24px 30px; border-radius: 8px 8px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <img src="${s.logo_url}" alt="${s.name}" style="height: 44px; width: auto; display: block;" />
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Zahlungsinformationen</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background: white; padding: 40px; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <p style="margin: 0 0 20px; font-size: 15px; color: ${EMAIL_COLORS.textPrimary};">${salutation},</p>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                nachfolgend finden Sie die Zahlungsinformationen zu Ihrer Bestellung.
              </p>

              <!-- Full Order Info -->
              ${orderInfoBlock}

              <!-- Warehouse Hinweis -->
              ${WAREHOUSE_HINWEIS(s)}

              <!-- Bank Details -->
              <div style="margin: 32px 0; border: 1px solid ${EMAIL_COLORS.border};">
                <div style="background: ${EMAIL_COLORS.backgroundLight}; padding: 16px 20px; border-bottom: 1px solid ${EMAIL_COLORS.border};">
                  <div style="font-weight: 600; color: ${EMAIL_COLORS.textPrimary}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Bankverbindung</div>
                </div>
                <div style="padding: 20px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; background: ${EMAIL_COLORS.backgroundLight}; width: 160px; color: ${EMAIL_COLORS.textSecondary}; font-size: 13px;">Kontoinhaber</td>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; color: ${EMAIL_COLORS.textPrimary}; font-size: 13px;">${s.payment_recipient}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; background: ${EMAIL_COLORS.backgroundLight}; color: ${EMAIL_COLORS.textSecondary}; font-size: 13px;">IBAN</td>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; color: ${EMAIL_COLORS.textPrimary}; font-size: 13px; font-family: 'Courier New', monospace;">${s.iban}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; background: ${EMAIL_COLORS.backgroundLight}; color: ${EMAIL_COLORS.textSecondary}; font-size: 13px;">BIC</td>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; color: ${EMAIL_COLORS.textPrimary}; font-size: 13px; font-family: 'Courier New', monospace;">${s.bic}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; background: ${EMAIL_COLORS.backgroundLight}; color: ${EMAIL_COLORS.textSecondary}; font-size: 13px;">Kreditinstitut</td>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; color: ${EMAIL_COLORS.textPrimary}; font-size: 13px;">${s.bank_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; background: ${EMAIL_COLORS.backgroundLight}; color: ${EMAIL_COLORS.textSecondary}; font-size: 13px;">Verwendungszweck</td>
                      <td style="padding: 10px 12px; border: 1px solid ${EMAIL_COLORS.border}; color: ${EMAIL_COLORS.textPrimary}; font-size: 13px; font-weight: 600;">${order.order_no}</td>
                    </tr>
                  </table>
                  <div style="margin-top: 16px; padding: 16px; background: ${EMAIL_COLORS.backgroundMuted}; border-left: 4px solid ${EMAIL_COLORS.textMuted};">
                    <p style="margin: 0; color: ${EMAIL_COLORS.textSecondary}; font-size: 13px; line-height: 1.6;">
                      <strong>Wichtig:</strong> Bitte geben Sie unbedingt die Bestellnummer <strong>${order.order_no}</strong> als Verwendungszweck an, damit wir Ihre Zahlung korrekt zuordnen können.
                    </p>
                  </div>
                </div>
              </div>

              <p style="margin: 0 0 20px; color: ${EMAIL_COLORS.textSecondary}; font-size: 14px; line-height: 1.7;">
                Nach Zahlungseingang wird Ihre Bestellung umgehend für den Versand vorbereitet.
              </p>

              <p style="margin: 24px 0 0; font-size: 14px; color: ${EMAIL_COLORS.textPrimary};">
                Mit freundlichen Grüßen<br>
                ${s.name}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: ${EMAIL_COLORS.backgroundMuted}; padding: 24px 40px; text-align: center; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <div style="color: ${EMAIL_COLORS.textMuted}; font-size: 12px; line-height: 1.8;">
                ${s.legal_name}<br>
                ${s.address_street}, ${s.address_zip} ${s.address_city}<br>
                ${s.email} | ${s.phone}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

function getCancelledEmail(order: Order, s: CompanySettings): { subject: string; html: string } {
  const salutation = getSalutation(order);
  const orderInfoBlock = getOrderInfoBlockHtml(order);

  return {
    subject: `Stornierungsbestätigung – Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stornierungsbestätigung ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.backgroundMuted}; font-family: ${EMAIL_FONT_STACK};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${EMAIL_COLORS.backgroundMuted};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: ${EMAIL_COLORS.headerDark}; padding: 24px 30px; border-radius: 8px 8px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <img src="${s.logo_url}" alt="${s.name}" style="height: 44px; width: auto; display: block;" />
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Stornierungsbestätigung</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background: white; padding: 40px; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <p style="margin: 0 0 20px; font-size: 15px; color: ${EMAIL_COLORS.textPrimary};">${salutation},</p>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                hiermit bestätigen wir die Stornierung Ihrer Bestellung.
              </p>

              <!-- Full Order Info -->
              ${orderInfoBlock}

              <div style="background: ${EMAIL_COLORS.backgroundLight}; border-left: 4px solid ${EMAIL_COLORS.textMuted}; padding: 20px; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.textSecondary}; line-height: 1.7;">
                  Sollten Sie bereits eine Zahlung geleistet haben, wird der entsprechende Betrag
                  innerhalb von 5–7 Werktagen auf Ihr Konto zurückerstattet.
                </p>
              </div>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                Sollten Sie Fragen zur Stornierung haben oder weitere Unterstützung benotigen,
                stehen wir Ihnen selbstverständlich jederzeit zur Verfügung.
              </p>

              <p style="margin: 24px 0 0; font-size: 14px; color: ${EMAIL_COLORS.textPrimary};">
                Mit freundlichen Grüßen<br>
                ${s.name}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: ${EMAIL_COLORS.backgroundMuted}; padding: 24px 40px; text-align: center; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <div style="color: ${EMAIL_COLORS.textMuted}; font-size: 12px; line-height: 1.8;">
                ${s.legal_name}<br>
                ${s.address_street}, ${s.address_zip} ${s.address_city}<br>
                ${s.email} | ${s.phone}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

function getShippedEmail(order: Order, s: CompanySettings): { subject: string; html: string } {
  const salutation = getSalutation(order);
  const orderInfoBlock = getOrderInfoBlockHtml(order);
  const deliveryDate = order.delivery_date
    ? new Date(order.delivery_date).toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return {
    subject: `Versandbestätigung – Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Versandbestätigung ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.backgroundMuted}; font-family: ${EMAIL_FONT_STACK};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${EMAIL_COLORS.backgroundMuted};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: ${EMAIL_COLORS.headerDark}; padding: 24px 30px; border-radius: 8px 8px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <img src="${s.logo_url}" alt="${s.name}" style="height: 44px; width: auto; display: block;" />
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <div style="font-size: 11px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Versandbestätigung</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background: white; padding: 40px; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <p style="margin: 0 0 20px; font-size: 15px; color: ${EMAIL_COLORS.textPrimary};">${salutation},</p>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                wir freuen uns, Ihnen mitteilen zu können, dass Ihre Bestellung für den Versand vorbereitet wurde und sich auf dem Weg zu Ihnen befindet.
              </p>

              <!-- Delivery Status -->
              <div style="background: ${EMAIL_COLORS.backgroundLight}; border-left: 4px solid ${EMAIL_COLORS.accent}; padding: 20px; margin: 24px 0;">
                <div style="font-weight: 600; color: ${EMAIL_COLORS.textPrimary}; margin-bottom: 12px;">Lieferstatus</div>
                ${deliveryDate
                  ? `<p style="margin: 0 0 8px; font-size: 14px; color: ${EMAIL_COLORS.textSecondary};"><strong>Voraussichtlicher Liefertermin:</strong> ${deliveryDate}</p>`
                  : `<p style="margin: 0 0 8px; font-size: 14px; color: ${EMAIL_COLORS.textSecondary};">Die Lieferung erfolgt voraussichtlich innerhalb der nächsten 1–3 Werktage.</p>`
                }
                ${order.delivery_window ? `<p style="margin: 0; font-size: 14px; color: ${EMAIL_COLORS.textSecondary};"><strong>Zeitfenster:</strong> ${order.delivery_window}</p>` : ''}
              </div>

              <!-- Full Order Info -->
              ${orderInfoBlock}

              <!-- Delivery Tips -->
              <div style="margin-top: 24px; padding: 16px 20px; background: ${EMAIL_COLORS.backgroundLight}; border-left: 4px solid ${EMAIL_COLORS.textMuted};">
                <p style="margin: 0 0 8px; font-weight: 600; color: ${EMAIL_COLORS.textPrimary}; font-size: 14px;">Wichtige Hinweise zur Lieferung</p>
                <ul style="margin: 0; padding-left: 20px; color: ${EMAIL_COLORS.textSecondary}; font-size: 13px; line-height: 1.6;">
                  <li>Bitte stellen Sie sicher, dass der Lieferort am Liefertag zugänglich ist.</li>
                  <li>Der LKW benötigt ausreichend Platz zum Rangieren (ca. 3 m Breite).</li>
                  <li>Bei Silolieferung: Bitte prüfen Sie, dass der Befüllstutzen erreichbar ist.</li>
                </ul>
              </div>

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.textSecondary};">
                Bei Fragen zur Lieferung stehen wir Ihnen selbstverständlich jederzeit zur Verfügung.
              </p>

              <p style="margin: 24px 0 0; font-size: 14px; color: ${EMAIL_COLORS.textPrimary};">
                Mit freundlichen Grüßen<br>
                ${s.name}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: ${EMAIL_COLORS.backgroundMuted}; padding: 24px 40px; text-align: center; border: 1px solid ${EMAIL_COLORS.border}; border-top: none;">
              <div style="color: ${EMAIL_COLORS.textMuted}; font-size: 12px; line-height: 1.8;">
                ${s.legal_name}<br>
                ${s.address_street}, ${s.address_zip} ${s.address_city}<br>
                ${s.email} | ${s.phone}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}


// ============================================
// SEND EMAIL FUNCTION
// ============================================

export async function sendEmail(
  emailType: EmailType,
  order: Order
): Promise<SendEmailResult> {
  try {
    const settings = await getCompanySettings();
    let template: { subject: string; html: string };

    switch (emailType) {
      case 'weekend_hello':
        template = getWeekendHelloEmail(order, settings);
        break;
      case 'confirmation':
        template = getConfirmationEmail(order, settings);
        break;
      case 'payment_instructions':
        template = getPaymentInstructionsEmail(order, settings);
        break;
      case 'shipped':
        template = getShippedEmail(order, settings);
        break;
      case 'cancelled':
        template = getCancelledEmail(order, settings);
        break;
      default:
        return { success: false, error: `Unknown email type: ${emailType}` };
    }

    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: order.email,
      subject: template.subject,
      html: template.html,
    });

    if (error) {
      console.error(`[ERROR] Email send failed (${emailType}):`, error);
      return { success: false, error: error.message };
    }

    console.log(`[OK] Email sent (${emailType}) to ${order.email}: ${data?.id}`);
    return { success: true, messageId: data?.id };

  } catch (error) {
    console.error(`[ERROR] Email error (${emailType}):`, error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// PROCESS EMAIL OUTBOX
// ============================================

export async function processEmailOutbox(): Promise<{ processed: number; failed: number }> {
  const { getPendingEmails, updateOutboxEntry } = await import('./memory-store');
  
  const pending = getPendingEmails();
  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    const { getOrderById } = await import('./memory-store');
    const order = getOrderById(entry.order_id);
    
    if (!order) {
      updateOutboxEntry(entry.id, { status: 'failed', error_message: 'Order not found' });
      failed++;
      continue;
    }

    const result = await sendEmail(entry.email_type, order);
    
    if (result.success) {
      updateOutboxEntry(entry.id, { 
        status: 'sent', 
        sent_at: new Date().toISOString() 
      });
      processed++;
    } else {
      updateOutboxEntry(entry.id, { 
        status: 'failed', 
        error_message: result.error,
        attempts: (entry.attempts || 0) + 1,
      });
      failed++;
    }
  }

  return { processed, failed };
}















