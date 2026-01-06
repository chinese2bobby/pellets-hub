import { NextRequest, NextResponse } from 'next/server';
import { Order, PaymentMethod, Salutation } from '@/types';

// Import email template functions (we'll extract them)
import { COMPANY, PRODUCTS } from '@/config';
import { formatCurrency, getEpcQrCodeUrl } from '@/lib/utils';

// Valid payment methods
const VALID_PAYMENT_METHODS: PaymentMethod[] = ['vorkasse', 'rechnung', 'lastschrift', 'paypal', 'klarna'];

// ============================================
// GREETING HELPER
// ============================================

function getGreeting(order: Order): string {
  const lastName = order.customer_name.split(' ').pop() || order.customer_name;

  switch (order.salutation) {
    case 'herr':
      return `Sehr geehrter Herr ${lastName}`;
    case 'frau':
      return `Sehr geehrte Frau ${lastName}`;
    case 'firma':
      return order.company_name
        ? `Sehr geehrte Damen und Herren der ${order.company_name}`
        : 'Sehr geehrte Damen und Herren';
    case 'divers':
      return `Guten Tag ${order.customer_name}`;
    default:
      return 'Guten Tag';
  }
}

// ============================================
// PAYMENT BLOCK HELPER
// ============================================

function getPaymentBlockHtml(order: Order): string {
  const totalGross = order.totals.total_gross;
  const paymentMethod = order.payment_method;

  // Calculate amounts
  const discount2Percent = Math.round(totalGross * 0.02);
  const discount10Percent = Math.round(totalGross * 0.10);
  const amountWith2PercentDiscount = totalGross - discount2Percent;
  const amountWith10PercentDiscount = totalGross - discount10Percent;
  const halfAmount = Math.round(totalGross / 2);

  // Bank details table (professional black/white, no bank branch name)
  const bankDetailsTable = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 8px 0; color: #666; width: 140px; font-size: 13px; border-bottom: 1px solid #e5e5e5;">Empfänger</td>
        <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; border-bottom: 1px solid #e5e5e5;"><strong>${COMPANY.payment_recipient}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #e5e5e5;">IBAN</td>
        <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; border-bottom: 1px solid #e5e5e5;">${COMPANY.iban}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #e5e5e5;">BIC</td>
        <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; border-bottom: 1px solid #e5e5e5;">${COMPANY.bic}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666; font-size: 13px;">Verwendungszweck</td>
        <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${order.order_no}</td>
      </tr>
    </table>`;

  // VORKASSE - Prepayment (styled like Rechnung, compact)
  if (paymentMethod === 'vorkasse') {
    const subtotalNet = order.totals.subtotal_net;
    const vatAmount = order.totals.vat_amount;
    const vatRate = order.totals.vat_rate;
    const vatLabel = order.totals.vat_label;

    // QR code URL - uses EPC format for German/Austrian banking apps
    const qrCodeSrc = getEpcQrCodeUrl(amountWith2PercentDiscount, order.order_no);

    return `
      <!-- Zahlungsübersicht: Vorkasse (Compact) -->
      <div style="margin-top: 40px;">

        <!-- Section Header -->
        <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px; font-weight: 500;">Zahlungsübersicht</div>

        <!-- Zahlungsart Info -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
          <tr>
            <td style="padding: 0 0 6px; color: #666; font-size: 12px;">Zahlungsart</td>
            <td style="padding: 0 0 6px; text-align: right; color: #1a1a1a; font-size: 12px; font-weight: 500;">Vorkasse</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666; font-size: 12px;">Zahlungsbedingung</td>
            <td style="padding: 6px 0; text-align: right; color: #1a1a1a; font-size: 12px;">100% Vorauszahlung</td>
          </tr>
        </table>

        <!-- Combined Green Block: Amounts + QR + Bank -->
        <div style="padding: 20px; background: linear-gradient(135deg, #f8faf6 0%, #f3f7f1 100%); border: 1px solid #d8e4d0; border-left: 4px solid #2D5016;">

          <!-- Beträge Section -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 4px 0; color: #666; font-size: 12px;">Zwischensumme (netto)</td>
              <td style="padding: 4px 0; text-align: right; color: #555; font-size: 12px;">${formatCurrency(subtotalNet, order.country)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #666; font-size: 12px;">${vatLabel} (${(vatRate * 100).toFixed(0)}%)</td>
              <td style="padding: 4px 0; text-align: right; color: #555; font-size: 12px;">${formatCurrency(vatAmount, order.country)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #444; font-size: 12px;">Gesamtbetrag (brutto)</td>
              <td style="padding: 4px 0; text-align: right; color: #444; font-size: 12px;">${formatCurrency(totalGross, order.country)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #2D5016; font-size: 12px;">Skonto 2% (bei Zahlung in 3 Tagen)</td>
              <td style="padding: 4px 0; text-align: right; color: #2D5016; font-size: 12px;">- ${formatCurrency(discount2Percent, order.country)}</td>
            </tr>
          </table>

          <!-- Zu überweisen - Prominent -->
          <div style="padding: 12px 16px; background: #fff; border: 1px solid #d8e4d0; margin: 16px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="vertical-align: middle;">
                  <div style="color: #1a1a1a; font-size: 14px; font-weight: 600;">Zu überweisen</div>
                  <div style="color: #888; font-size: 11px; margin-top: 4px;">Ohne Skonto (nach 3 Tagen): ${formatCurrency(totalGross, order.country)}</div>
                </td>
                <td style="text-align: right; color: #2D5016; font-size: 20px; font-weight: 700; vertical-align: middle;">${formatCurrency(amountWith2PercentDiscount, order.country)}</td>
              </tr>
            </table>
          </div>

          <!-- Divider -->
          <div style="border-top: 1px solid #e0e8db; margin-bottom: 16px;"></div>

          <!-- QR Code + Bankdaten Row -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <!-- QR Code -->
              <td style="width: 140px; vertical-align: top; padding-right: 20px;">
                <div style="background: #fff; padding: 6px; display: inline-block; border: 1px solid #e0e8db;">
                  <img src="${qrCodeSrc}" width="110" height="110" alt="QR-Code" style="display:block; border:0;">
                </div>
                <p style="margin: 8px 0 0; color: #888; font-size: 10px;">Banking-App scannen</p>
              </td>
              <!-- Bankdaten -->
              <td style="vertical-align: top;">
                <div style="font-size: 10px; color: #2D5016; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; font-weight: 600;">Bankverbindung</div>
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Empfänger</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 12px; font-weight: 500;">${COMPANY.payment_recipient}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">IBAN</td>
                    <td style="padding: 3px 0; color: #2D5016; font-size: 13px; font-weight: 700;">${COMPANY.iban}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">BIC</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 12px;">${COMPANY.bic}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Verwendungszweck</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 13px; font-weight: 700;">${order.order_no}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Betrag</td>
                    <td style="padding: 3px 0; color: #2D5016; font-size: 13px; font-weight: 700;">${formatCurrency(amountWith2PercentDiscount, order.country)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </div>

        <!-- Hinweis zum Reservelager -->
        <div style="margin-top: 16px; padding: 14px 16px; background: #f5f5f5; border: 1px solid #e0e0e0; border-left: 3px solid #888;">
          <p style="margin: 0; color: #555; font-size: 12px; line-height: 1.6;">
            <strong>Hinweis:</strong> Der Zahlungsempfänger (${COMPANY.payment_recipient}) ist unser Logistikpartner. Die Zahlung wird Ihrer Bestellung korrekt zugeordnet.
          </p>
        </div>

        <!-- Footer note -->
        <p style="margin: 16px 0 0; color: #aaa; font-size: 10px;">
          Nach Zahlungseingang wird Ihre Bestellung für den Versand vorbereitet.
        </p>

      </div>`;
  }

  // KLARNA, PAYPAL, LASTSCHRIFT - Unavailable, offer 10% discount for Vorkasse
  if (paymentMethod === 'klarna' || paymentMethod === 'paypal' || paymentMethod === 'lastschrift') {
    const methodName = paymentMethod === 'klarna' ? 'Klarna' : paymentMethod === 'paypal' ? 'PayPal' : 'Lastschrift';
    const subtotalNet = order.totals.subtotal_net;
    const vatAmount = order.totals.vat_amount;
    const vatRate = order.totals.vat_rate;
    const vatLabel = order.totals.vat_label;

    // QR code URL - uses EPC format for German/Austrian banking apps
    const qrCodeSrc = getEpcQrCodeUrl(amountWith10PercentDiscount, order.order_no);

    return `
      <!-- Zahlungsübersicht: ${methodName} → Vorkasse mit 10% Rabatt -->
      <div style="margin-top: 40px;">

        <!-- Section Header -->
        <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px; font-weight: 500;">Zahlungsübersicht</div>

        <!-- Zahlungsart Info -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
          <tr>
            <td style="padding: 0 0 6px; color: #666; font-size: 12px;">Gewählte Zahlungsart</td>
            <td style="padding: 0 0 6px; text-align: right; color: #c0392b; font-size: 12px; font-weight: 500;">${methodName} (nicht verfügbar)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666; font-size: 12px;">Alternative</td>
            <td style="padding: 6px 0; text-align: right; color: #2D5016; font-size: 12px; font-weight: 500;">Vorkasse mit 10% Rabatt</td>
          </tr>
        </table>

        <!-- Hinweis zur Nichtverfügbarkeit -->
        <div style="padding: 14px 16px; background: #fef9f9; border: 1px solid #f5c6c6; border-left: 4px solid #c0392b; margin-bottom: 16px;">
          <p style="margin: 0; color: #333; font-size: 12px; line-height: 1.6;">
            <strong style="color: #c0392b;">Hinweis:</strong> Die Zahlungsart ${methodName} ist aufgrund einer temporären Überlastung unseres Zahlungsdienstleisters derzeit nicht verfügbar. Wir bitten um Ihr Verständnis und bieten Ihnen als Entschädigung <strong>10% Rabatt</strong> bei Zahlung per Banküberweisung.
          </p>
        </div>

        <!-- Combined Green Block: Amounts + QR + Bank -->
        <div style="padding: 20px; background: linear-gradient(135deg, #f8faf6 0%, #f3f7f1 100%); border: 1px solid #d8e4d0; border-left: 4px solid #2D5016;">

          <!-- Beträge Section -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding: 4px 0; color: #666; font-size: 12px;">Zwischensumme (netto)</td>
              <td style="padding: 4px 0; text-align: right; color: #555; font-size: 12px;">${formatCurrency(subtotalNet, order.country)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #666; font-size: 12px;">${vatLabel} (${(vatRate * 100).toFixed(0)}%)</td>
              <td style="padding: 4px 0; text-align: right; color: #555; font-size: 12px;">${formatCurrency(vatAmount, order.country)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #444; font-size: 12px;">Gesamtbetrag (brutto)</td>
              <td style="padding: 4px 0; text-align: right; color: #444; font-size: 12px;">${formatCurrency(totalGross, order.country)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #2D5016; font-size: 12px;">Ihr Rabatt (10%)</td>
              <td style="padding: 4px 0; text-align: right; color: #2D5016; font-size: 12px;">- ${formatCurrency(discount10Percent, order.country)}</td>
            </tr>
          </table>

          <!-- Zu überweisen - Prominent -->
          <div style="padding: 12px 16px; background: #fff; border: 1px solid #d8e4d0; margin: 16px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="vertical-align: middle;">
                  <div style="color: #1a1a1a; font-size: 14px; font-weight: 600;">Zu überweisen</div>
                  <div style="color: #2D5016; font-size: 11px; margin-top: 4px;">Sie sparen ${formatCurrency(discount10Percent, order.country)}</div>
                </td>
                <td style="text-align: right; color: #2D5016; font-size: 20px; font-weight: 700; vertical-align: middle;">${formatCurrency(amountWith10PercentDiscount, order.country)}</td>
              </tr>
            </table>
          </div>

          <!-- Divider -->
          <div style="border-top: 1px solid #e0e8db; margin-bottom: 16px;"></div>

          <!-- QR Code + Bankdaten Row -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <!-- QR Code -->
              <td style="width: 140px; vertical-align: top; padding-right: 20px;">
                <div style="background: #fff; padding: 6px; display: inline-block; border: 1px solid #e0e8db;">
                  <img src="${qrCodeSrc}" width="110" height="110" alt="QR-Code" style="display:block; border:0;">
                </div>
                <p style="margin: 8px 0 0; color: #888; font-size: 10px;">Banking-App scannen</p>
              </td>
              <!-- Bankdaten -->
              <td style="vertical-align: top;">
                <div style="font-size: 10px; color: #2D5016; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; font-weight: 600;">Bankverbindung</div>
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Empfänger</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 12px; font-weight: 500;">${COMPANY.payment_recipient}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">IBAN</td>
                    <td style="padding: 3px 0; color: #2D5016; font-size: 13px; font-weight: 700;">${COMPANY.iban}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">BIC</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 12px;">${COMPANY.bic}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Verwendungszweck</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 13px; font-weight: 700;">${order.order_no}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Betrag</td>
                    <td style="padding: 3px 0; color: #2D5016; font-size: 13px; font-weight: 700;">${formatCurrency(amountWith10PercentDiscount, order.country)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </div>

        <!-- Hinweis zum Reservelager -->
        <div style="margin-top: 16px; padding: 14px 16px; background: #f5f5f5; border: 1px solid #e0e0e0; border-left: 3px solid #888;">
          <p style="margin: 0; color: #555; font-size: 12px; line-height: 1.6;">
            <strong>Hinweis:</strong> Der Zahlungsempfänger (${COMPANY.payment_recipient}) ist unser Logistikpartner. Die Zahlung wird Ihrer Bestellung korrekt zugeordnet.
          </p>
        </div>

        <!-- Footer note -->
        <p style="margin: 16px 0 0; color: #aaa; font-size: 10px;">
          Nach Zahlungseingang wird Ihre Bestellung für den Versand vorbereitet.
        </p>

      </div>`;
  }

  // RECHNUNG - Invoice with 50% deposit (combined totals + payment block)
  // Professional B2B German style with QR code
  if (paymentMethod === 'rechnung') {
    const subtotalNet = order.totals.subtotal_net;
    const vatAmount = order.totals.vat_amount;
    const vatRate = order.totals.vat_rate;
    const vatLabel = order.totals.vat_label;

    // QR code URL - uses EPC format for German/Austrian banking apps
    const qrCodeSrc = getEpcQrCodeUrl(halfAmount, order.order_no);

    return `
      <!-- Zahlungsübersicht: Rechnung mit Anzahlung -->
      <div style="margin-top: 40px;">

        <!-- Section Header -->
        <div style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px; font-weight: 500;">Zahlungsübersicht</div>

        <!-- Zahlungsart Info -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
          <tr>
            <td style="padding: 0 0 6px; color: #666; font-size: 12px;">Zahlungsart</td>
            <td style="padding: 0 0 6px; text-align: right; color: #1a1a1a; font-size: 12px; font-weight: 500;">Kauf auf Rechnung</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666; font-size: 12px;">Freigabestatus</td>
            <td style="padding: 6px 0; text-align: right; color: #1a1a1a; font-size: 12px;">Anzahlung erforderlich</td>
          </tr>
        </table>

        <!-- Beträge -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 4px 0; color: #666; font-size: 12px;">Zwischensumme (netto)</td>
            <td style="padding: 4px 0; text-align: right; color: #555; font-size: 12px;">${formatCurrency(subtotalNet, order.country)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #666; font-size: 12px;">${vatLabel} (${(vatRate * 100).toFixed(0)}%)</td>
            <td style="padding: 4px 0; text-align: right; color: #555; font-size: 12px;">${formatCurrency(vatAmount, order.country)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #444; font-size: 12px;">Gesamtbetrag (brutto)</td>
            <td style="padding: 4px 0; text-align: right; color: #444; font-size: 12px;">${formatCurrency(totalGross, order.country)}</td>
          </tr>
        </table>

        <!-- Divider -->
        <div style="border-top: 1px solid #e5e5e5; margin: 16px 0;"></div>

        <!-- Anzahlung Block - PROMINENT -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 4px;">
          <tr>
            <td style="padding: 8px 0; color: #1a1a1a; font-size: 15px; font-weight: 600;">Anzahlung (50%)</td>
            <td style="padding: 8px 0; text-align: right; color: #2D5016; font-size: 22px; font-weight: 700;">${formatCurrency(halfAmount, order.country)}</td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding: 4px 0; color: #888; font-size: 11px;">Restbetrag nach Lieferung</td>
            <td style="padding: 4px 0; text-align: right; color: #666; font-size: 11px;">${formatCurrency(halfAmount, order.country)}</td>
          </tr>
        </table>

        <!-- Hinweis zur Zahlungsfreigabe -->
        <div style="margin-top: 16px; padding: 14px 16px; background: linear-gradient(135deg, #f8faf6 0%, #f3f7f1 100%); border: 1px solid #d8e4d0; border-left: 4px solid #2D5016;">
          <p style="margin: 0; color: #333; font-size: 12px; line-height: 1.6;">
            <strong style="color: #2D5016;">Hinweis zur Zahlungsfreigabe:</strong> Leider liegen uns derzeit nicht ausreichend Informationen vor, um Ihre Bestellung auf Rechnung freizugeben. Wir bieten Ihnen daher unser Standardverfahren für Neukunden an: eine Anzahlung von 50% des Gesamtbetrags. Der Restbetrag wird nach Lieferung in Rechnung gestellt (Zahlungsziel: 30 Tage).
          </p>
        </div>

        <!-- QR Code + Bankdaten Combined Block -->
        <div style="margin-top: 16px; padding: 20px; background: linear-gradient(135deg, #f8faf6 0%, #f3f7f1 100%); border: 1px solid #d8e4d0; border-left: 4px solid #2D5016;">

          <!-- QR Code + Bankdaten Row -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <!-- QR Code -->
              <td style="width: 140px; vertical-align: top; padding-right: 20px;">
                <div style="background: #fff; padding: 6px; display: inline-block; border: 1px solid #e0e8db;">
                  <img src="${qrCodeSrc}" width="110" height="110" alt="QR-Code" style="display:block; border:0;">
                </div>
                <p style="margin: 8px 0 0; color: #888; font-size: 10px;">Banking-App scannen</p>
              </td>
              <!-- Bankdaten -->
              <td style="vertical-align: top;">
                <div style="font-size: 10px; color: #2D5016; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; font-weight: 600;">Bankverbindung</div>
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Empfänger</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 12px; font-weight: 500;">${COMPANY.payment_recipient}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">IBAN</td>
                    <td style="padding: 3px 0; color: #2D5016; font-size: 13px; font-weight: 700;">${COMPANY.iban}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">BIC</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 12px;">${COMPANY.bic}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Verwendungszweck</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 13px; font-weight: 700;">${order.order_no}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Betrag</td>
                    <td style="padding: 3px 0; color: #2D5016; font-size: 13px; font-weight: 700;">${formatCurrency(halfAmount, order.country)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 12px 3px 0; color: #666; font-size: 12px;">Zahlungsfrist</td>
                    <td style="padding: 3px 0; color: #1a1a1a; font-size: 12px;">72 Stunden</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </div>

        <!-- Hinweis zum Reservelager -->
        <div style="margin-top: 16px; padding: 14px 16px; background: #f5f5f5; border: 1px solid #e0e0e0; border-left: 3px solid #888;">
          <p style="margin: 0; color: #555; font-size: 12px; line-height: 1.6;">
            <strong>Hinweis:</strong> Der Zahlungsempfänger (${COMPANY.payment_recipient}) ist unser Logistikpartner. Die Zahlung wird Ihrer Bestellung korrekt zugeordnet.
          </p>
        </div>

        <!-- Footer note -->
        <p style="margin: 16px 0 0; color: #aaa; font-size: 10px;">
          Dies ist eine Bestellbestätigung mit Zahlungsanweisung. Die Rechnung erhalten Sie nach erfolgreicher Lieferung.
        </p>

      </div>`;
  }

  return '';
}

// ============================================
// EMAIL TEMPLATES (copied for preview)
// ============================================

function getWeekendHelloEmail(order: Order): { subject: string; html: string } {
  const orderDate = new Date(order.created_at).toLocaleDateString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  // Font stack with TASA Orbiter
  const fontStack = "'TASA Orbiter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Brand green accent
  const brandGreen = '#2D5016';

  return {
    subject: `Eingangsbestätigung - Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eingangsbestätigung ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: ${fontStack};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="border-bottom: 3px solid ${brandGreen}; padding-bottom: 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px;">
                      ${COMPANY.name}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: bottom;">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
                      Eingangsbestätigung
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Info Bar -->
          <tr>
            <td style="padding: 24px 0; border-bottom: 1px solid #eee;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 500;">Bestellnummer</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${brandGreen};">${order.order_no}</div>
                  </td>
                  <td align="right">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 500;">Datum</div>
                    <div style="font-size: 14px; color: #1a1a1a;">${orderDate}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 0;">

              <!-- Greeting -->
              <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.7;">
                ${getGreeting(order)},<br><br>
                vielen Dank für Ihre Bestellung bei <strong>${COMPANY.name}</strong>.
              </p>

              <!-- Weekend Notice -->
              <div style="padding: 20px; background: #f9f9f9; border-left: 3px solid ${brandGreen}; margin-bottom: 24px;">
                <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.6;">
                  Wir haben Ihre Bestellung am Wochenende erhalten. Ihr Auftrag befindet sich in unserer Warteschlange und wird zu <strong>Beginn der nächsten Arbeitswoche</strong> bearbeitet.
                </p>
              </div>

              <!-- Order Summary -->
              <div style="margin-bottom: 32px;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; font-weight: 500;">Bestellübersicht</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #e5e5e5;">Gesamtbetrag</td>
                    <td style="padding: 8px 0; text-align: right; color: ${brandGreen}; font-size: 16px; font-weight: 700; border-bottom: 1px solid #e5e5e5;">${formatCurrency(order.totals.total_gross, order.country)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 13px;">Zahlungsart</td>
                    <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 13px;">${order.payment_method === 'vorkasse' ? 'Vorkasse' : order.payment_method === 'rechnung' ? 'Rechnung' : order.payment_method === 'klarna' ? 'Klarna' : order.payment_method === 'paypal' ? 'PayPal' : 'Lastschrift'}</td>
                  </tr>
                </table>
              </div>

              <!-- Next Steps -->
              <p style="margin: 0 0 24px; color: #444; font-size: 14px; line-height: 1.6;">
                Sie erhalten in Kürze eine ausführliche Bestätigung mit allen Details zu Ihrer Bestellung und den Zahlungsinformationen.
              </p>

              <!-- Closing -->
              <p style="margin: 32px 0 0; font-size: 14px; color: #333; line-height: 1.8;">
                Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.<br><br>
                Mit freundlichen Grüßen<br>
                <strong>${COMPANY.name}</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #eee; padding-top: 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">${COMPANY.legal_name}</strong><br>
                    ${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}
                  </td>
                  <td align="right" style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">Kontakt</strong><br>
                    ${COMPANY.email}<br>
                    ${COMPANY.phone}
                  </td>
                </tr>
              </table>
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

function getConfirmationEmail(order: Order): { subject: string; html: string } {
  const firstName = order.customer_name.split(' ')[0];
  const orderDate = new Date(order.created_at).toLocaleDateString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  // Get payment-specific content
  const paymentBlockHtml = getPaymentBlockHtml(order);

  // Font stack with TASA Orbiter
  const fontStack = "'TASA Orbiter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Brand green accent
  const brandGreen = '#2D5016';

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 14px 0; border-bottom: 1px solid #e5e5e5;">
        <div style="font-weight: 600; color: #1a1a1a; font-size: 14px;">${item.name}</div>
        <div style="font-size: 12px; color: #888; margin-top: 4px;">Art.-Nr: ${item.sku}</div>
      </td>
      <td style="padding: 14px 0; border-bottom: 1px solid #e5e5e5; text-align: center; color: #444; font-size: 14px;">${item.quantity} ${item.unit === 'palette' ? 'Pal.' : item.unit}</td>
      <td style="padding: 14px 0; border-bottom: 1px solid #e5e5e5; text-align: right; color: #1a1a1a; font-size: 14px;">${formatCurrency(item.line_total_net, order.country)}</td>
    </tr>
  `).join('');

  return {
    subject: `Bestellbestätigung ${order.order_no} - ${COMPANY.name}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bestellbestätigung ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: ${fontStack};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="border-bottom: 3px solid ${brandGreen}; padding-bottom: 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px;">
                      ${COMPANY.name}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: bottom;">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
                      Bestellbestätigung
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Info Bar -->
          <tr>
            <td style="padding: 24px 0; border-bottom: 1px solid #eee;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 500;">Bestellnummer</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${brandGreen};">${order.order_no}</div>
                  </td>
                  <td align="right">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 500;">Datum</div>
                    <div style="font-size: 14px; color: #1a1a1a;">${orderDate}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 0;">

              <!-- Greeting -->
              <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.7;">
                ${getGreeting(order)},<br><br>
                vielen Dank für Ihre Bestellung bei <strong>${COMPANY.name}</strong>. Wir haben Ihren Auftrag erhalten und werden ihn umgehend bearbeiten.
              </p>

              <!-- Delivery Address -->
              <div style="margin-bottom: 32px;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; font-weight: 500;">Lieferadresse</div>
                <div style="color: #333; line-height: 1.8; font-size: 14px;">
                  <strong>${order.customer_name}</strong><br>
                  ${order.delivery_address.street} ${order.delivery_address.house_no || ''}<br>
                  ${order.delivery_address.zip} ${order.delivery_address.city}<br>
                  ${order.country === 'AT' ? 'Oesterreich' : 'Deutschland'}
                </div>
              </div>

              <!-- Order Items -->
              <div style="margin-bottom: 32px;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; font-weight: 500;">Bestellpositionen</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <thead>
                    <tr>
                      <th style="padding: 10px 0; text-align: left; font-weight: 600; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #ddd;">Produkt</th>
                      <th style="padding: 10px 0; text-align: center; font-weight: 600; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #ddd;">Menge</th>
                      <th style="padding: 10px 0; text-align: right; font-weight: 600; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #ddd;">Netto</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
              </div>

              <!-- Totals (skip for Rechnung/Vorkasse/Klarna/PayPal/Lastschrift - included in payment block) -->
              ${!['rechnung', 'vorkasse', 'klarna', 'paypal', 'lastschrift'].includes(order.payment_method) ? `
              <div style="margin-bottom: 32px; padding: 20px; background: #f9f9f9; border-left: 3px solid ${brandGreen};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 6px 0; color: #666; font-size: 13px;">Zwischensumme (netto)</td>
                    <td style="padding: 6px 0; text-align: right; color: #444; font-size: 13px;">${formatCurrency(order.totals.subtotal_net, order.country)}</td>
                  </tr>
                  ${order.totals.is_reverse_charge ? `
                  <tr>
                    <td style="padding: 6px 0; color: #666; font-size: 13px;">USt. (Reverse Charge)</td>
                    <td style="padding: 6px 0; text-align: right; color: #444; font-size: 13px;">0,00 EUR</td>
                  </tr>
                  ` : `
                  <tr>
                    <td style="padding: 6px 0; color: #666; font-size: 13px;">${order.totals.vat_label} (${(order.totals.vat_rate * 100).toFixed(0)}%)</td>
                    <td style="padding: 6px 0; text-align: right; color: #444; font-size: 13px;">${formatCurrency(order.totals.vat_amount, order.country)}</td>
                  </tr>
                  `}
                  <tr>
                    <td colspan="2" style="padding: 12px 0 8px;">
                      <div style="border-top: 1px solid #ddd;"></div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0; font-size: 15px; font-weight: 700; color: #1a1a1a;">Gesamtbetrag</td>
                    <td style="padding: 0; text-align: right; font-size: 18px; font-weight: 700; color: ${brandGreen};">${formatCurrency(order.totals.total_gross, order.country)}</td>
                  </tr>
                </table>
                ${order.totals.is_reverse_charge ? `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #888;">
                  Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge gem. Art. 196 MwStSystRL).
                  ${order.vat_id ? `UID-Nr.: ${order.vat_id}` : ''}
                </div>
                ` : ''}
              </div>
              ` : ''}

              <!-- Payment Block (method-specific) -->
              ${paymentBlockHtml}

              <!-- Next Steps -->
              <div style="margin-top: 32px; padding: 20px; border-left: 3px solid #ddd; background: #f9f9f9;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; font-weight: 500;">Nächste Schritte</div>
                <p style="margin: 0; color: #444; font-size: 14px; line-height: 1.6;">
                  ${order.payment_method === 'vorkasse' ? 'Nach Zahlungseingang wird Ihre Bestellung für den Versand vorbereitet.' :
                    order.payment_method === 'rechnung' ? 'Nach Eingang der Anzahlung wird Ihre Bestellung für den Versand vorbereitet.' :
                    'Wir informieren Sie per E-Mail über den Lieferstatus.'}
                </p>
              </div>

              <!-- Closing -->
              <p style="margin: 32px 0 0; font-size: 14px; color: #333; line-height: 1.8;">
                Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.<br><br>
                Mit freundlichen Grüßen<br>
                <strong>${COMPANY.name}</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #eee; padding-top: 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">${COMPANY.legal_name}</strong><br>
                    ${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}
                  </td>
                  <td align="right" style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">Kontakt</strong><br>
                    ${COMPANY.email}<br>
                    ${COMPANY.phone}
                  </td>
                </tr>
              </table>
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

function getPaymentInstructionsEmail(order: Order): { subject: string; html: string } {
  const totalGross = order.totals.total_gross;
  const discount2Percent = Math.round(totalGross * 0.02);
  const amountWith2PercentDiscount = totalGross - discount2Percent;

  // Font stack with TASA Orbiter
  const fontStack = "'TASA Orbiter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Brand green accent
  const brandGreen = '#2D5016';

  return {
    subject: `Zahlungsinformationen - Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zahlungsinformationen ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: ${fontStack};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="border-bottom: 3px solid ${brandGreen}; padding-bottom: 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px;">
                      ${COMPANY.name}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: bottom;">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
                      Zahlungsinformationen
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Info Bar -->
          <tr>
            <td style="padding: 24px 0; border-bottom: 1px solid #eee;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 500;">Bestellnummer</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${brandGreen};">${order.order_no}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 0;">

              <!-- Greeting -->
              <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.7;">
                ${getGreeting(order)},<br><br>
                nachfolgend finden Sie die Zahlungsinformationen für Ihre Bestellung.
              </p>

              <!-- Amount Box -->
              <div style="padding: 20px; background: #f9f9f9; border-left: 3px solid ${brandGreen}; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 4px 0; color: #666; font-size: 13px;">Rechnungsbetrag</td>
                    <td style="padding: 4px 0; text-align: right; color: #444; font-size: 13px;">${formatCurrency(totalGross, order.country)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #666; font-size: 13px;">Skonto (2% bei Zahlung innerhalb 3 Tagen)</td>
                    <td style="padding: 4px 0; text-align: right; color: ${brandGreen}; font-size: 13px;">- ${formatCurrency(discount2Percent, order.country)}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 10px 0 6px;"><div style="border-top: 1px solid #ddd;"></div></td>
                  </tr>
                  <tr>
                    <td style="padding: 0; color: #1a1a1a; font-size: 15px; font-weight: 700;">Zu überweisen</td>
                    <td style="padding: 0; text-align: right; color: ${brandGreen}; font-size: 18px; font-weight: 700;">${formatCurrency(amountWith2PercentDiscount, order.country)}</td>
                  </tr>
                </table>
              </div>

              <!-- Bank Details -->
              <div style="margin-bottom: 32px;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; font-weight: 500;">Bankverbindung</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 8px 0; color: #666; width: 140px; font-size: 13px; border-bottom: 1px solid #e5e5e5;">Empfänger</td>
                    <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; border-bottom: 1px solid #e5e5e5;"><strong>${COMPANY.payment_recipient}</strong><br><span style="color: #666;">${COMPANY.bank_name}</span></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #e5e5e5;">IBAN</td>
                    <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; border-bottom: 1px solid #e5e5e5;">${COMPANY.iban}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 13px; border-bottom: 1px solid #e5e5e5;">BIC</td>
                    <td style="padding: 8px 0; color: #1a1a1a; font-size: 13px; border-bottom: 1px solid #e5e5e5;">${COMPANY.bic}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 13px;">Verwendungszweck</td>
                    <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${order.order_no}</td>
                  </tr>
                </table>
              </div>

              <!-- Important Notice -->
              <div style="padding: 16px 20px; background: #f9f9f9; border-left: 3px solid #888; margin-bottom: 24px;">
                <p style="margin: 0; color: #444; font-size: 13px; line-height: 1.6;">
                  <strong>Wichtig:</strong> Bitte geben Sie die Bestellnummer <strong>${order.order_no}</strong> als Verwendungszweck an.
                </p>
              </div>

              <!-- Next Steps -->
              <p style="margin: 0 0 24px; color: #444; font-size: 14px; line-height: 1.6;">
                Für eine zügige Bearbeitung bitten wir Sie, die Überweisung innerhalb von 7 Tagen vorzunehmen. Nach Zahlungseingang wird Ihre Bestellung für den Versand vorbereitet.
              </p>

              <!-- Closing -->
              <p style="margin: 32px 0 0; font-size: 14px; color: #333; line-height: 1.8;">
                Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.<br><br>
                Mit freundlichen Grüßen<br>
                <strong>${COMPANY.name}</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #eee; padding-top: 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">${COMPANY.legal_name}</strong><br>
                    ${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}
                  </td>
                  <td align="right" style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">Kontakt</strong><br>
                    ${COMPANY.email}<br>
                    ${COMPANY.phone}
                  </td>
                </tr>
              </table>
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

function getCancelledEmail(order: Order): { subject: string; html: string } {
  // Font stack with TASA Orbiter
  const fontStack = "'TASA Orbiter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return {
    subject: `Stornierung - Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stornierung ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: ${fontStack};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="border-bottom: 3px solid #666; padding-bottom: 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px;">
                      ${COMPANY.name}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: bottom;">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
                      Stornierung
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Info Bar -->
          <tr>
            <td style="padding: 24px 0; border-bottom: 1px solid #eee;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 500;">Bestellnummer</div>
                    <div style="font-size: 20px; font-weight: 700; color: #666;">${order.order_no}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 0;">

              <!-- Greeting -->
              <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.7;">
                ${getGreeting(order)},<br><br>
                wir bestätigen hiermit die Stornierung Ihrer Bestellung.
              </p>

              <!-- Cancellation Notice -->
              <div style="padding: 20px; background: #f9f9f9; border-left: 3px solid #666; margin-bottom: 24px;">
                <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.6;">
                  Ihre Bestellung <strong>${order.order_no}</strong> wurde storniert.
                </p>
              </div>

              <!-- Refund Info -->
              <p style="margin: 0 0 24px; color: #444; font-size: 14px; line-height: 1.6;">
                Falls Sie bereits eine Zahlung geleistet haben, wird der Betrag innerhalb von <strong>5-7 Werktagen</strong> auf Ihr Konto zurückerstattet.
              </p>

              <!-- Closing -->
              <p style="margin: 32px 0 0; font-size: 14px; color: #333; line-height: 1.8;">
                Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.<br><br>
                Mit freundlichen Grüßen<br>
                <strong>${COMPANY.name}</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #eee; padding-top: 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">${COMPANY.legal_name}</strong><br>
                    ${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}
                  </td>
                  <td align="right" style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">Kontakt</strong><br>
                    ${COMPANY.email}<br>
                    ${COMPANY.phone}
                  </td>
                </tr>
              </table>
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

function getShippedEmail(order: Order): { subject: string; html: string } {
  // Font stack with TASA Orbiter
  const fontStack = "'TASA Orbiter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Brand green accent
  const brandGreen = '#2D5016';

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; color: #1a1a1a; font-size: 14px;">${item.quantity}x ${item.name}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; text-align: right; color: #444; font-size: 14px;">${formatCurrency(item.line_total_net, order.country)}</td>
    </tr>
  `).join('');

  return {
    subject: `Versandbestätigung - Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Versandbestätigung ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: ${fontStack};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="border-bottom: 3px solid ${brandGreen}; padding-bottom: 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px;">
                      ${COMPANY.name}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: bottom;">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
                      Versandbestätigung
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Info Bar -->
          <tr>
            <td style="padding: 24px 0; border-bottom: 1px solid #eee;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 500;">Bestellnummer</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${brandGreen};">${order.order_no}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 0;">

              <!-- Greeting -->
              <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.7;">
                ${getGreeting(order)},<br><br>
                Ihre Bestellung wurde versendet und ist auf dem Weg zu Ihnen.
              </p>

              <!-- Shipping Notice -->
              <div style="padding: 20px; background: #f9f9f9; border-left: 3px solid ${brandGreen}; margin-bottom: 24px;">
                <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.6;">
                  <strong>Ihre Holzpellets wurden versendet.</strong><br>
                  Die Lieferung erfolgt in den nächsten <strong>1-3 Werktagen</strong>.
                </p>
              </div>

              <!-- Delivery Address -->
              <div style="margin-bottom: 32px;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; font-weight: 500;">Lieferadresse</div>
                <div style="color: #333; line-height: 1.8; font-size: 14px;">
                  <strong>${order.customer_name}</strong><br>
                  ${order.delivery_address.street} ${order.delivery_address.house_no || ''}<br>
                  ${order.delivery_address.zip} ${order.delivery_address.city}<br>
                  ${order.country === 'AT' ? 'Oesterreich' : 'Deutschland'}
                </div>
              </div>

              <!-- Order Items -->
              <div style="margin-bottom: 32px;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; font-weight: 500;">Bestellübersicht</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${itemsHtml}
                  <tr>
                    <td style="padding: 12px 0; font-size: 15px; font-weight: 700; color: #1a1a1a;">Gesamtbetrag</td>
                    <td style="padding: 12px 0; text-align: right; font-size: 16px; font-weight: 700; color: ${brandGreen};">${formatCurrency(order.totals.total_gross, order.country)}</td>
                  </tr>
                </table>
              </div>

              <!-- Important Notice -->
              <div style="padding: 16px 20px; background: #f9f9f9; border-left: 3px solid #888; margin-bottom: 24px;">
                <p style="margin: 0; color: #444; font-size: 13px; line-height: 1.6;">
                  <strong>Hinweis:</strong> Bitte stellen Sie sicher, dass der Lieferort am Liefertag zugänglich ist. Der LKW benötigt ausreichend Platz zum Rangieren.
                </p>
              </div>

              <!-- Closing -->
              <p style="margin: 32px 0 0; font-size: 14px; color: #333; line-height: 1.8;">
                Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.<br><br>
                Mit freundlichen Grüßen<br>
                <strong>${COMPANY.name}</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #eee; padding-top: 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">${COMPANY.legal_name}</strong><br>
                    ${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}
                  </td>
                  <td align="right" style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">Kontakt</strong><br>
                    ${COMPANY.email}<br>
                    ${COMPANY.phone}
                  </td>
                </tr>
              </table>
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

function getDeliveredEmail(order: Order): { subject: string; html: string } {
  // Font stack with TASA Orbiter
  const fontStack = "'TASA Orbiter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Brand green accent
  const brandGreen = '#2D5016';

  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; color: #1a1a1a; font-size: 14px;">${item.quantity}x ${item.name}</td>
    </tr>
  `).join('');

  return {
    subject: `Lieferbestätigung - Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lieferbestätigung ${order.order_no}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: ${fontStack};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="border-bottom: 3px solid ${brandGreen}; padding-bottom: 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3px;">
                      ${COMPANY.name}
                    </div>
                  </td>
                  <td align="right" style="vertical-align: bottom;">
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">
                      Lieferbestätigung
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Order Info Bar -->
          <tr>
            <td style="padding: 24px 0; border-bottom: 1px solid #eee;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: 500;">Bestellnummer</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${brandGreen};">${order.order_no}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 0;">

              <!-- Greeting -->
              <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.7;">
                ${getGreeting(order)},<br><br>
                wir freuen uns, Ihnen mitteilen zu können, dass Ihre Bestellung erfolgreich zugestellt wurde.
              </p>

              <!-- Delivery Confirmation -->
              <div style="padding: 20px; background: #f9f9f9; border-left: 3px solid ${brandGreen}; margin-bottom: 24px;">
                <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.6;">
                  <strong>Ihre Holzpellets wurden erfolgreich geliefert.</strong><br>
                  Die Ware wurde fachgerecht an der gewuenschten Stelle abgeladen.
                </p>
              </div>

              <!-- Delivered Items -->
              <div style="margin-bottom: 32px;">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; font-weight: 500;">Gelieferte Produkte</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${itemsHtml}
                </table>
              </div>

              <!-- Feedback Request -->
              <div style="padding: 16px 20px; background: #f9f9f9; border-left: 3px solid #888; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; color: #444; font-size: 13px; font-weight: 600;">Waren Sie zufrieden?</p>
                <p style="margin: 0; color: #666; font-size: 13px; line-height: 1.6;">
                  Wir freuen uns ueber Ihre Bewertung. Ihr Feedback hilft uns, unseren Service zu verbessern.
                </p>
              </div>

              <!-- Thank You -->
              <p style="margin: 0 0 24px; color: #444; font-size: 14px; line-height: 1.6;">
                Vielen Dank fuer Ihr Vertrauen in <strong>${COMPANY.name}</strong>.
              </p>

              <!-- Closing -->
              <p style="margin: 32px 0 0; font-size: 14px; color: #333; line-height: 1.8;">
                Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.<br><br>
                Mit freundlichen Grüßen<br>
                <strong>${COMPANY.name}</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #eee; padding-top: 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">${COMPANY.legal_name}</strong><br>
                    ${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}
                  </td>
                  <td align="right" style="color: #888; font-size: 12px; line-height: 1.8;">
                    <strong style="color: #666;">Kontakt</strong><br>
                    ${COMPANY.email}<br>
                    ${COMPANY.phone}
                  </td>
                </tr>
              </table>
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
// DEMO ORDERS FOR PREVIEW
// ============================================

function createDemoOrder(
  type: 'de-b2c' | 'at-b2c' | 'de-b2b' | 'at-b2b-rc',
  paymentMethod: PaymentMethod = 'vorkasse'
): Order {
  const baseOrder = {
    id: 'demo-' + type,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    order_type: 'normal' as const,
    status: 'confirmed' as const,
    payment_status: 'pending' as const,
    payment_method: paymentMethod,
    email_flags: {
      weekend_hello_sent: false,
      confirmation_sent: false,
      payment_instructions_sent: false,
    },
    needs_weekend_hello: false,
  };

  // Demo prices in cents (net)
  const DEMO_PRICES = {
    premium_sack: { DE: 28900, AT: 29900 }, // €289 / €299 per palette
    eco_palette: { DE: 25900, AT: 26900 },  // €259 / €269 per palette
  };

  switch (type) {
    case 'de-b2c': {
      const priceNet = DEMO_PRICES.eco_palette.DE;
      const product = PRODUCTS.eco_palette;
      return {
        ...baseOrder,
        order_no: 'DEMO-DE-B2C',
        country: 'DE',
        salutation: 'herr',
        customer_name: 'Max Mustermann',
        email: 'max@example.de',
        phone: '+49 170 1234567',
        delivery_address: {
          street: 'Hauptstraße',
          house_no: '42',
          zip: '10115',
          city: 'Berlin',
          country: 'DE',
        },
        delivery_notes: '',
        items: [{
          sku: product.sku,
          name: product.name_de,
          quantity: 2,
          unit: 'palette' as const,
          unit_price_net: priceNet,
          line_total_net: priceNet * 2,
        }],
        totals: {
          subtotal_net: priceNet * 2,
          vat_rate: 0.07,
          vat_label: 'MwSt.',
          vat_amount: Math.round(priceNet * 2 * 0.07),
          total_gross: Math.round(priceNet * 2 * 1.07),
          is_reverse_charge: false,
        },
      };
    }

    case 'at-b2c': {
      const priceNet = DEMO_PRICES.premium_sack.AT;
      const product = PRODUCTS.premium_sack;
      return {
        ...baseOrder,
        order_no: 'DEMO-AT-B2C',
        country: 'AT',
        salutation: 'frau',
        customer_name: 'Anna Schmidt',
        email: 'anna@example.at',
        phone: '+43 660 9876543',
        delivery_address: {
          street: 'Ringstraße',
          house_no: '10',
          zip: '1010',
          city: 'Wien',
          country: 'AT',
        },
        delivery_notes: 'Bitte beim Nachbarn klingeln',
        items: [{
          sku: product.sku,
          name: product.name_at,
          quantity: 1,
          unit: 'palette' as const,
          unit_price_net: priceNet,
          line_total_net: priceNet,
        }],
        totals: {
          subtotal_net: priceNet,
          vat_rate: 0.20,
          vat_label: 'USt.',
          vat_amount: Math.round(priceNet * 0.20),
          total_gross: Math.round(priceNet * 1.20),
          is_reverse_charge: false,
        },
      };
    }

    case 'de-b2b': {
      const priceNet = DEMO_PRICES.premium_sack.DE;
      const product = PRODUCTS.premium_sack;
      return {
        ...baseOrder,
        order_no: 'DEMO-DE-B2B',
        country: 'DE',
        salutation: 'firma',
        customer_name: 'Thomas Müller',
        company_name: 'Müller GmbH',
        email: 'buchhaltung@mueller-gmbh.de',
        phone: '+49 89 12345678',
        vat_id: 'DE123456789',
        delivery_address: {
          street: 'Industriestraße',
          house_no: '55',
          zip: '80331',
          city: 'München',
          country: 'DE',
        },
        delivery_notes: '',
        items: [{
          sku: product.sku,
          name: product.name_de,
          quantity: 3,
          unit: 'palette' as const,
          unit_price_net: priceNet,
          line_total_net: priceNet * 3,
        }],
        totals: {
          subtotal_net: priceNet * 3,
          vat_rate: 0.07,
          vat_label: 'MwSt.',
          vat_amount: Math.round(priceNet * 3 * 0.07),
          total_gross: Math.round(priceNet * 3 * 1.07),
          is_reverse_charge: false,
        },
      };
    }

    case 'at-b2b-rc': {
      const priceNet = DEMO_PRICES.premium_sack.AT;
      const product = PRODUCTS.premium_sack;
      return {
        ...baseOrder,
        order_no: 'DEMO-AT-B2B-RC',
        country: 'AT',
        salutation: 'firma',
        customer_name: 'Hans Huber',
        company_name: 'Holzbau Österreich GmbH',
        email: 'einkauf@holzbau.at',
        phone: '+43 1 98765432',
        vat_id: 'ATU12345678',
        delivery_address: {
          street: 'Industriepark',
          house_no: '100',
          zip: '1230',
          city: 'Wien',
          country: 'AT',
        },
        delivery_notes: 'LKW-Zufahrt über Tor 3',
        items: [{
          sku: product.sku,
          name: product.name_at,
          quantity: 5,
          unit: 'palette' as const,
          unit_price_net: priceNet,
          line_total_net: priceNet * 5,
        }],
        totals: {
          subtotal_net: priceNet * 5,
          vat_rate: 0,
          vat_label: 'USt.',
          vat_amount: 0,
          total_gross: priceNet * 5,
          is_reverse_charge: true,
        },
      };
    }
  }
}

// ============================================
// API ROUTE
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const emailType = searchParams.get('type') || 'confirmation';
  const orderType = searchParams.get('order') || 'de-b2c';
  const paymentMethod = searchParams.get('payment') || 'vorkasse';

  const validEmailTypes = ['weekend_hello', 'confirmation', 'payment_instructions', 'cancelled', 'shipped', 'delivered'];
  const validOrderTypes = ['de-b2c', 'at-b2c', 'de-b2b', 'at-b2b-rc'];

  if (!validEmailTypes.includes(emailType)) {
    return NextResponse.json({
      error: `Invalid email type. Valid types: ${validEmailTypes.join(', ')}`
    }, { status: 400 });
  }

  if (!validOrderTypes.includes(orderType)) {
    return NextResponse.json({
      error: `Invalid order type. Valid types: ${validOrderTypes.join(', ')}`
    }, { status: 400 });
  }

  if (!VALID_PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)) {
    return NextResponse.json({
      error: `Invalid payment method. Valid methods: ${VALID_PAYMENT_METHODS.join(', ')}`
    }, { status: 400 });
  }

  const order = createDemoOrder(
    orderType as 'de-b2c' | 'at-b2c' | 'de-b2b' | 'at-b2b-rc',
    paymentMethod as PaymentMethod
  );

  let template: { subject: string; html: string };

  switch (emailType) {
    case 'weekend_hello':
      template = getWeekendHelloEmail(order);
      break;
    case 'confirmation':
      template = getConfirmationEmail(order);
      break;
    case 'payment_instructions':
      template = getPaymentInstructionsEmail(order);
      break;
    case 'cancelled':
      template = getCancelledEmail(order);
      break;
    case 'shipped':
      template = getShippedEmail(order);
      break;
    case 'delivered':
      template = getDeliveredEmail(order);
      break;
    default:
      template = getConfirmationEmail(order);
  }

  // Return HTML for browser preview
  return new NextResponse(template.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
