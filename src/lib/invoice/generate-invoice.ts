// Invoice HTML Generator - Pelletor
// Generates professional invoices with country-specific formatting

import { Order, Salutation, Country } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { COMPANY, COUNTRY_CONFIG } from '@/config';

export interface InvoiceData {
  invoiceNo: string;
  order: Order;
  generatedAt: Date;
}

// Get proper salutation based on customer data
export function getSalutation(
  salutation: Salutation | undefined,
  customerName: string,
  hasCompany: boolean
): string {
  // For companies, use formal greeting
  if (hasCompany || salutation === 'firma') {
    return 'Sehr geehrte Damen und Herren';
  }

  const lastName = customerName.split(' ').pop() || customerName;

  switch (salutation) {
    case 'herr':
      return `Sehr geehrter Herr ${lastName}`;
    case 'frau':
      return `Sehr geehrte Frau ${lastName}`;
    case 'divers':
      return `Guten Tag ${customerName}`;
    default:
      // Try to guess from first name (German naming convention)
      return `Guten Tag ${customerName}`;
  }
}

// Generate invoice number based on country and order sequence
export function generateInvoiceNo(order: Order): string {
  const year = new Date().getFullYear();
  return `RE-${order.country}-${year}-${String(order.order_seq).padStart(6, '0')}`;
}

// Format date in German style
function formatDateDE(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Generate the full invoice HTML
export function generateInvoiceHTML(data: InvoiceData): string {
  const { invoiceNo, order, generatedAt } = data;
  const config = COUNTRY_CONFIG[order.country];
  const hasCompany = Boolean(order.company_name);
  const salutation = getSalutation(order.salutation, order.customer_name, hasCompany);

  // Payment info based on method
  const getPaymentInfo = () => {
    switch (order.payment_method) {
      case 'vorkasse':
        return `
          <div class="payment-box">
            <h3>Zahlungsinformationen</h3>
            <table class="bank-info">
              <tr><td><strong>Empfänger:</strong></td><td>${COMPANY.payment_recipient}</td></tr>
              <tr><td><strong>IBAN:</strong></td><td>${COMPANY.iban}</td></tr>
              <tr><td><strong>BIC:</strong></td><td>${COMPANY.bic}</td></tr>
              <tr><td><strong>Bank:</strong></td><td>${COMPANY.bank_name}</td></tr>
              <tr><td><strong>Verwendungszweck:</strong></td><td><strong>${order.order_no}</strong></td></tr>
            </table>
            <p class="payment-note">Bitte überweisen Sie den Betrag innerhalb von 14 Tagen unter Angabe der Bestellnummer.</p>
          </div>
        `;
      case 'lastschrift':
        return `
          <div class="payment-box">
            <p>Der Betrag wird per SEPA-Lastschrift von Ihrem Konto eingezogen.</p>
          </div>
        `;
      case 'paypal':
        return `
          <div class="payment-box">
            <p>Zahlung erfolgt über PayPal.</p>
          </div>
        `;
      case 'klarna':
        return `
          <div class="payment-box">
            <p>Zahlung erfolgt über Klarna. Details finden Sie in Ihrer Klarna-App.</p>
          </div>
        `;
      default:
        return '';
    }
  };

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${invoiceNo}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
    }

    .invoice {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15mm;
      padding-bottom: 10mm;
      border-bottom: 2px solid #2D5016;
    }

    .logo {
      max-height: 60px;
    }

    .company-info {
      text-align: right;
      font-size: 9pt;
      color: #666;
    }

    .company-info strong {
      color: #2D5016;
      font-size: 14pt;
    }

    /* Addresses */
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15mm;
    }

    .recipient {
      font-size: 10pt;
      line-height: 1.6;
    }

    .recipient .label {
      font-size: 8pt;
      color: #666;
      margin-bottom: 2mm;
    }

    .invoice-details {
      text-align: right;
    }

    .invoice-details table {
      margin-left: auto;
    }

    .invoice-details td {
      padding: 2px 0;
    }

    .invoice-details td:first-child {
      text-align: right;
      padding-right: 10px;
      color: #666;
    }

    .invoice-details td:last-child {
      font-weight: 500;
    }

    /* Title */
    .invoice-title {
      font-size: 18pt;
      font-weight: 600;
      color: #2D5016;
      margin-bottom: 5mm;
    }

    /* Greeting */
    .greeting {
      margin-bottom: 10mm;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10mm;
    }

    .items-table th {
      background: #f5f5f5;
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #2D5016;
    }

    .items-table th.right,
    .items-table td.right {
      text-align: right;
    }

    .items-table th.center,
    .items-table td.center {
      text-align: center;
    }

    .items-table td {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }

    /* Totals */
    .totals {
      margin-left: auto;
      width: 50%;
      margin-bottom: 10mm;
    }

    .totals table {
      width: 100%;
      border-collapse: collapse;
    }

    .totals td {
      padding: 5px 10px;
    }

    .totals td:last-child {
      text-align: right;
    }

    .totals .subtotal {
      border-bottom: 1px solid #ddd;
    }

    .totals .vat {
      color: #666;
    }

    .totals .total {
      font-size: 12pt;
      font-weight: 700;
      border-top: 2px solid #2D5016;
      color: #2D5016;
    }

    .totals .total td {
      padding-top: 10px;
    }

    /* Payment */
    .payment-box {
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 10mm;
    }

    .payment-box h3 {
      font-size: 11pt;
      margin-bottom: 10px;
      color: #2D5016;
    }

    .bank-info {
      width: 100%;
    }

    .bank-info td {
      padding: 3px 0;
    }

    .bank-info td:first-child {
      width: 140px;
    }

    .payment-note {
      margin-top: 10px;
      font-size: 9pt;
      color: #666;
    }

    /* Footer */
    .footer {
      margin-top: 15mm;
      padding-top: 10mm;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }

    .footer p {
      margin-bottom: 3px;
    }

    /* Legal notes */
    .legal-notes {
      margin-top: 10mm;
      font-size: 8pt;
      color: #666;
    }

    .legal-notes p {
      margin-bottom: 5px;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .invoice {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <!-- Header -->
    <div class="header">
      <div>
        <img src="${COMPANY.logo_url || 'https://pelletor.at/assets/logo.png'}" alt="${COMPANY.name}" class="logo" />
      </div>
      <div class="company-info">
        <strong>${COMPANY.name}</strong><br>
        ${COMPANY.legal_name}<br>
        ${COMPANY.address.street}<br>
        ${COMPANY.address.zip} ${COMPANY.address.city}<br>
        ${order.country === 'AT' ? 'Österreich' : 'Deutschland'}<br>
        <br>
        Tel: ${COMPANY.phone}<br>
        ${COMPANY.email}
        ${COMPANY.vat_id ? `<br>USt-IdNr: ${COMPANY.vat_id}` : ''}
      </div>
    </div>

    <!-- Addresses -->
    <div class="addresses">
      <div class="recipient">
        <div class="label">Rechnungsempfänger:</div>
        ${order.company_name ? `<strong>${order.company_name}</strong><br>` : ''}
        ${order.customer_name}<br>
        ${order.delivery_address.street} ${order.delivery_address.house_no}<br>
        ${order.delivery_address.zip} ${order.delivery_address.city}<br>
        ${order.country === 'AT' ? 'Österreich' : 'Deutschland'}
        ${order.vat_id ? `<br>USt-IdNr: ${order.vat_id}` : ''}
      </div>
      <div class="invoice-details">
        <table>
          <tr>
            <td>Rechnungsnummer:</td>
            <td><strong>${invoiceNo}</strong></td>
          </tr>
          <tr>
            <td>Rechnungsdatum:</td>
            <td>${formatDateDE(generatedAt)}</td>
          </tr>
          <tr>
            <td>Bestellnummer:</td>
            <td>${order.order_no}</td>
          </tr>
          <tr>
            <td>Bestelldatum:</td>
            <td>${formatDateDE(new Date(order.created_at))}</td>
          </tr>
          <tr>
            <td>Kundennummer:</td>
            <td>${order.user_id || 'Gast'}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Title -->
    <h1 class="invoice-title">Rechnung</h1>

    <!-- Greeting -->
    <div class="greeting">
      <p>${salutation},</p>
      <p>für Ihre Bestellung berechnen wir Ihnen folgende Positionen:</p>
    </div>

    <!-- Items -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40px;">Pos.</th>
          <th>Bezeichnung</th>
          <th class="center" style="width: 80px;">Menge</th>
          <th class="right" style="width: 100px;">Einzelpreis</th>
          <th class="right" style="width: 100px;">Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map((item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>
              ${item.name}<br>
              <span style="font-size: 9pt; color: #666;">Art.-Nr.: ${item.sku}</span>
            </td>
            <td class="center">${item.quantity} ${item.unit === 'palette' ? 'Pal.' : item.unit}</td>
            <td class="right">${formatCurrency(item.unit_price_net, order.country)}</td>
            <td class="right">${formatCurrency(item.line_total_net, order.country)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <table>
        <tr class="subtotal">
          <td>Zwischensumme (netto)</td>
          <td>${formatCurrency(order.totals.subtotal_net, order.country)}</td>
        </tr>
        ${order.totals.shipping_net > 0 ? `
          <tr>
            <td>Versandkosten</td>
            <td>${formatCurrency(order.totals.shipping_net, order.country)}</td>
          </tr>
        ` : ''}
        <tr class="vat">
          <td>zzgl. ${config.vat_label} (${(config.vat_rate * 100).toFixed(0)}%)</td>
          <td>${formatCurrency(order.totals.vat_amount, order.country)}</td>
        </tr>
        <tr class="total">
          <td><strong>Gesamtbetrag</strong></td>
          <td><strong>${formatCurrency(order.totals.total_gross, order.country)}</strong></td>
        </tr>
      </table>
    </div>

    <!-- Payment Info -->
    ${getPaymentInfo()}

    <!-- Legal Notes -->
    <div class="legal-notes">
      <p>Lieferung erfolgt gemäß unseren AGB. Es gelten die gesetzlichen Gewährleistungsrechte.</p>
      ${order.country === 'AT'
        ? '<p>Leistungszeitraum entspricht dem Lieferdatum. Rechnungsbetrag enthält 20% USt.</p>'
        : '<p>Leistungszeitraum entspricht dem Lieferdatum. Auf Holzpellets wird der ermäßigte Steuersatz von 7% angewandt (§ 12 Abs. 2 Nr. 1 UStG).</p>'
      }
    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>${COMPANY.legal_name}</strong></p>
      <p>${COMPANY.address.street} | ${COMPANY.address.zip} ${COMPANY.address.city} | ${order.country === 'AT' ? 'Österreich' : 'Deutschland'}</p>
      <p>Tel: ${COMPANY.phone} | E-Mail: ${COMPANY.email}</p>
      <p>IBAN: ${COMPANY.iban} | BIC: ${COMPANY.bic}</p>
      ${COMPANY.vat_id ? `<p>USt-IdNr: ${COMPANY.vat_id}</p>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Export types for use in API routes
export type { InvoiceData };
