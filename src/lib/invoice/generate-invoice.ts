// Invoice HTML Generator - Pelletor
// Modern design adapted from Heizline template
// Supports DE 7% MwSt, AT 20% USt, AT B2B Reverse Charge

import { Order, Salutation } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { COMPANY } from '@/config';

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

// Generate EPC QR Code URL for bank transfer
function generateEpcQrUrl(
  amount: number,
  reference: string,
  iban: string,
  bic: string,
  recipient: string
): string {
  const amountStr = (amount / 100).toFixed(2);
  const epcData = [
    'BCD',           // Service Tag
    '002',           // Version
    '1',             // Character Set (UTF-8)
    'SCT',           // SEPA Credit Transfer
    bic.replace(/\s/g, ''),
    recipient.substring(0, 70),
    iban.replace(/\s/g, ''),
    `EUR${amountStr}`,
    '',              // Purpose
    '',              // Structured Reference
    reference.substring(0, 140),
    ''               // Info
  ].join('\n');

  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(epcData)}`;
}

// Generate the full invoice HTML
export function generateInvoiceHTML(data: InvoiceData): string {
  const { invoiceNo, order, generatedAt } = data;
  const hasCompany = Boolean(order.company_name);
  const salutation = getSalutation(order.salutation, order.customer_name, hasCompany);
  const isReverseCharge = order.totals.is_reverse_charge === true;

  // Format amounts
  const subtotalNet = order.totals.subtotal_net;
  const vatAmount = order.totals.vat_amount;
  const totalGross = order.totals.total_gross;
  const vatRate = order.totals.vat_rate;
  const vatLabel = order.totals.vat_label;

  // QR Code for bank transfer (only for Vorkasse)
  const qrCodeUrl = order.payment_method === 'vorkasse'
    ? generateEpcQrUrl(
        totalGross,
        `Rechnung ${order.order_no}`,
        COMPANY.iban,
        COMPANY.bic,
        COMPANY.payment_recipient
      )
    : null;

  // Payment info based on method
  const getPaymentInfo = () => {
    switch (order.payment_method) {
      case 'vorkasse':
        return `
          <div class="payment-info">
            <div class="payment-info-title">Zahlungsinformationen</div>
            <div class="payment-detail">
              <span class="payment-detail-label">Empfänger</span>
              <span class="payment-detail-value">${COMPANY.payment_recipient}</span>
            </div>
            <div class="payment-detail">
              <span class="payment-detail-label">IBAN</span>
              <span class="payment-detail-value">${COMPANY.iban}</span>
            </div>
            <div class="payment-detail">
              <span class="payment-detail-label">BIC</span>
              <span class="payment-detail-value">${COMPANY.bic}</span>
            </div>
            <div class="payment-detail">
              <span class="payment-detail-label">Bank</span>
              <span class="payment-detail-value">${COMPANY.bank_name}</span>
            </div>
            <div class="payment-detail">
              <span class="payment-detail-label">Verwendungszweck</span>
              <span class="payment-detail-value highlight">${order.order_no}</span>
            </div>
            ${qrCodeUrl ? `
            <div class="qr-code-section">
              <img src="${qrCodeUrl}" alt="EPC QR Code" />
              <div class="qr-code-label">QR-Code scannen<br>für schnelle Überweisung</div>
            </div>
            ` : ''}
          </div>
        `;
      case 'lastschrift':
        return `
          <div class="payment-info">
            <div class="payment-info-title">Zahlungsinformationen</div>
            <p class="payment-note">Der Betrag wird per SEPA-Lastschrift von Ihrem Konto eingezogen.</p>
          </div>
        `;
      case 'paypal':
        return `
          <div class="payment-info">
            <div class="payment-info-title">Zahlungsinformationen</div>
            <p class="payment-note">Zahlung erfolgt über PayPal.</p>
          </div>
        `;
      case 'klarna':
        return `
          <div class="payment-info">
            <div class="payment-info-title">Zahlungsinformationen</div>
            <p class="payment-note">Zahlung erfolgt über Klarna. Details finden Sie in Ihrer Klarna-App.</p>
          </div>
        `;
      default:
        return '';
    }
  };

  // Legal notes based on country and B2B status
  const getLegalNotes = () => {
    if (isReverseCharge) {
      return `
        <div class="legal-notes reverse-charge">
          <p><strong>Hinweis zur Steuerschuldumkehr (Reverse Charge):</strong></p>
          <p>Steuerschuldnerschaft des Leistungsempfängers gemäß Art. 196 MwStSystRL.</p>
          <p>Die Umsatzsteuer ist vom Leistungsempfänger zu entrichten.</p>
          <div class="vat-ids">
            <p><strong>UID-Nr. Leistungsempfänger:</strong> ${order.vat_id || '—'}</p>
            <p><strong>UID-Nr. Leistungserbringer:</strong> ${COMPANY.vat_id}</p>
          </div>
        </div>
      `;
    } else if (order.country === 'AT') {
      return `
        <div class="legal-notes">
          <p>Leistungszeitraum entspricht dem Lieferdatum. Rechnungsbetrag enthält 20% USt.</p>
        </div>
      `;
    } else {
      return `
        <div class="legal-notes">
          <p>Leistungszeitraum entspricht dem Lieferdatum.</p>
          <p>Auf Holzpellets wird der ermäßigte Steuersatz von 7% angewandt (§ 12 Abs. 2 Nr. 1 UStG i.V.m. Anlage 2 Nr. 48).</p>
        </div>
      `;
    }
  };

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${invoiceNo}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #1f2937;
      background: #ffffff;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm 15mm;
      -webkit-font-smoothing: antialiased;
    }

    @media print {
      body { padding: 0; margin: 0; }
      .page-break { page-break-after: always; }
    }

    /* Header */
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f3f4f6;
    }

    .company-logo-section { flex: 1; }

    .company-logo {
      max-width: 160px;
      height: auto;
      margin-bottom: 16px;
    }

    .company-details {
      font-size: 9pt;
      color: #6b7280;
      line-height: 1.6;
    }

    .company-details strong {
      display: block;
      font-size: 12pt;
      font-weight: 600;
      color: #2D5016;
      margin-bottom: 6px;
    }

    /* Invoice Meta */
    .invoice-meta {
      text-align: right;
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      border-left: 3px solid #2D5016;
      min-width: 220px;
    }

    .invoice-meta h1 {
      font-size: 22pt;
      font-weight: 700;
      color: #2D5016;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
    }

    .invoice-meta-item {
      display: flex;
      justify-content: space-between;
      margin: 6px 0;
      font-size: 9pt;
    }

    .invoice-meta-label {
      color: #6b7280;
      font-weight: 500;
    }

    .invoice-meta-value {
      color: #111827;
      font-weight: 600;
      margin-left: 16px;
    }

    /* Customer Address */
    .customer-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 32px;
      gap: 32px;
    }

    .customer-address {
      flex: 1;
      background: #f0fdf4;
      padding: 20px;
      border-radius: 8px;
      border-left: 3px solid #2D5016;
    }

    .customer-address-label {
      font-size: 8pt;
      color: #166534;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .customer-address p {
      font-size: 10pt;
      color: #111827;
      margin: 3px 0;
      line-height: 1.5;
    }

    .customer-name {
      font-weight: 600;
      font-size: 11pt;
      color: #000;
    }

    .company-name {
      font-weight: 700;
      font-size: 11pt;
      color: #2D5016;
    }

    .vat-id {
      font-size: 9pt;
      color: #166534;
      margin-top: 8px;
    }

    /* Greeting */
    .greeting {
      margin-bottom: 24px;
      font-size: 10pt;
      color: #374151;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      border-radius: 8px;
      overflow: hidden;
    }

    .items-table thead {
      background: linear-gradient(135deg, #2D5016 0%, #4A7C23 100%);
    }

    .items-table th {
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .items-table th.right { text-align: right; }
    .items-table th.center { text-align: center; }

    .items-table td {
      padding: 14px 16px;
      font-size: 10pt;
      color: #374151;
      border-bottom: 1px solid #f3f4f6;
    }

    .items-table td.right { text-align: right; }
    .items-table td.center { text-align: center; }

    .items-table tbody tr:last-child td { border-bottom: none; }
    .items-table tbody tr:hover { background: #f9fafb; }

    .item-name { font-weight: 500; color: #111827; }
    .item-sku { font-size: 8pt; color: #6b7280; margin-top: 2px; }

    /* Summary Section */
    .summary-section {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
      gap: 32px;
    }

    /* Payment Info */
    .payment-info {
      flex: 1;
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .payment-info-title {
      font-weight: 600;
      font-size: 11pt;
      color: #111827;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #2D5016;
    }

    .payment-detail {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
      font-size: 9pt;
    }

    .payment-detail-label {
      color: #6b7280;
      font-weight: 500;
    }

    .payment-detail-value {
      color: #111827;
      font-weight: 600;
      font-family: 'Courier New', monospace;
    }

    .payment-detail-value.highlight {
      color: #2D5016;
      font-weight: 700;
    }

    .payment-note {
      font-size: 9pt;
      color: #374151;
      line-height: 1.6;
      margin-top: 12px;
    }

    .qr-code-section {
      text-align: center;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }

    .qr-code-section img {
      width: 140px;
      height: 140px;
      margin-bottom: 8px;
    }

    .qr-code-label {
      font-size: 8pt;
      color: #6b7280;
      line-height: 1.4;
    }

    /* Totals */
    .summary-table {
      flex: 1;
      max-width: 320px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      font-size: 10pt;
      border-bottom: 1px solid #f3f4f6;
    }

    .summary-label { color: #6b7280; font-weight: 500; }
    .summary-value { color: #111827; font-weight: 600; min-width: 100px; text-align: right; }

    .summary-total {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 3px solid #2D5016;
      font-size: 13pt;
    }

    .summary-total .summary-label,
    .summary-total .summary-value {
      color: #2D5016;
      font-weight: 700;
    }

    /* Legal Notes */
    .legal-notes {
      margin-top: 32px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 6px;
      font-size: 8pt;
      color: #6b7280;
      line-height: 1.6;
    }

    .legal-notes p { margin: 4px 0; }

    .legal-notes.reverse-charge {
      background: #fef3c7;
      border-left: 3px solid #d97706;
      color: #92400e;
    }

    .legal-notes.reverse-charge p { color: #78350f; }

    .vat-ids {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #fcd34d;
    }

    /* Payment Terms */
    .payment-terms {
      margin-top: 24px;
      padding: 16px;
      background: #f0fdf4;
      border-radius: 6px;
      border-left: 3px solid #16a34a;
    }

    .payment-terms-title {
      font-weight: 600;
      font-size: 10pt;
      color: #166534;
      margin-bottom: 8px;
    }

    .payment-terms p {
      color: #15803d;
      font-size: 9pt;
      line-height: 1.5;
      margin: 4px 0;
    }

    /* Footer */
    .footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 2px solid #f3f4f6;
      font-size: 8pt;
      color: #9ca3af;
      line-height: 1.8;
    }

    .footer-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }

    .footer strong { color: #6b7280; font-weight: 600; }

    .footer-center {
      text-align: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #f3f4f6;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="invoice-header">
    <div class="company-logo-section">
      <img src="${COMPANY.logo_url}" alt="${COMPANY.name}" class="company-logo" onerror="this.style.display='none'" />
      <div class="company-details">
        <strong>${COMPANY.name}</strong>
        ${COMPANY.legal_name}<br>
        ${COMPANY.address.street}<br>
        ${COMPANY.address.zip} ${COMPANY.address.city}<br>
        Deutschland
      </div>
    </div>

    <div class="invoice-meta">
      <h1>RECHNUNG</h1>
      <div class="invoice-meta-item">
        <span class="invoice-meta-label">Rechnungs-Nr.</span>
        <span class="invoice-meta-value">${invoiceNo}</span>
      </div>
      <div class="invoice-meta-item">
        <span class="invoice-meta-label">Rechnungsdatum</span>
        <span class="invoice-meta-value">${formatDateDE(generatedAt)}</span>
      </div>
      <div class="invoice-meta-item">
        <span class="invoice-meta-label">Bestellnummer</span>
        <span class="invoice-meta-value">${order.order_no}</span>
      </div>
      <div class="invoice-meta-item">
        <span class="invoice-meta-label">Bestelldatum</span>
        <span class="invoice-meta-value">${formatDateDE(new Date(order.created_at))}</span>
      </div>
      ${order.delivery_date ? `
      <div class="invoice-meta-item">
        <span class="invoice-meta-label">Lieferdatum</span>
        <span class="invoice-meta-value">${formatDateDE(new Date(order.delivery_date))}</span>
      </div>
      ` : ''}
    </div>
  </div>

  <!-- Customer Address -->
  <div class="customer-section">
    <div class="customer-address">
      <div class="customer-address-label">Rechnungsempfänger</div>
      ${order.company_name ? `<p class="company-name">${order.company_name}</p>` : ''}
      <p class="customer-name">${order.customer_name}</p>
      <p>${order.delivery_address.street} ${order.delivery_address.house_no}</p>
      <p>${order.delivery_address.zip} ${order.delivery_address.city}</p>
      <p>${order.country === 'AT' ? 'Österreich' : 'Deutschland'}</p>
      ${order.vat_id ? `<p class="vat-id">UID-Nr.: ${order.vat_id}</p>` : ''}
    </div>
  </div>

  <!-- Greeting -->
  <div class="greeting">
    <p>${salutation},</p>
    <p>vielen Dank für Ihre Bestellung. Hiermit berechnen wir Ihnen folgende Positionen:</p>
  </div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 45%;">Beschreibung</th>
        <th class="center" style="width: 15%;">Menge</th>
        <th class="right" style="width: 20%;">Einzelpreis</th>
        <th class="right" style="width: 20%;">Gesamtpreis</th>
      </tr>
    </thead>
    <tbody>
      ${order.items.map(item => `
        <tr>
          <td>
            <div class="item-name">${item.name}</div>
            <div class="item-sku">Art.-Nr.: ${item.sku}</div>
          </td>
          <td class="center">${item.quantity} ${item.unit === 'palette' ? 'Pal.' : item.unit === 'kg' ? 'kg' : item.unit}</td>
          <td class="right">${formatCurrency(item.unit_price_net, order.country)}</td>
          <td class="right">${formatCurrency(item.line_total_net, order.country)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Summary Section -->
  <div class="summary-section">
    ${getPaymentInfo()}

    <div class="summary-table">
      <div class="summary-row">
        <div class="summary-label">Zwischensumme (netto)</div>
        <div class="summary-value">${formatCurrency(subtotalNet, order.country)}</div>
      </div>
      ${order.totals.shipping_net > 0 ? `
        <div class="summary-row">
          <div class="summary-label">Versandkosten</div>
          <div class="summary-value">${formatCurrency(order.totals.shipping_net, order.country)}</div>
        </div>
      ` : ''}
      ${isReverseCharge ? `
        <div class="summary-row">
          <div class="summary-label">${vatLabel}</div>
          <div class="summary-value">0,00 €</div>
        </div>
      ` : `
        <div class="summary-row">
          <div class="summary-label">zzgl. ${vatLabel} (${(vatRate * 100).toFixed(0)}%)</div>
          <div class="summary-value">${formatCurrency(vatAmount, order.country)}</div>
        </div>
      `}
      <div class="summary-row summary-total">
        <div class="summary-label">Gesamtbetrag</div>
        <div class="summary-value">${formatCurrency(totalGross, order.country)}</div>
      </div>
    </div>
  </div>

  <!-- Legal Notes -->
  ${getLegalNotes()}

  <!-- Payment Terms -->
  <div class="payment-terms">
    <div class="payment-terms-title">Zahlungsbedingungen</div>
    <p>Der Rechnungsbetrag ist innerhalb von 14 Tagen nach Erhalt dieser Rechnung ohne Abzug zur Zahlung fällig.</p>
    <p>Bitte verwenden Sie bei Ihrer Überweisung die Bestellnummer als Verwendungszweck.</p>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-row">
      <span><strong>${COMPANY.ceo_title}:</strong> ${COMPANY.ceo}</span>
      <span><strong>Handelsregister:</strong> ${COMPANY.company_register}, ${COMPANY.register_court}</span>
    </div>
    <div class="footer-row">
      <span><strong>USt-IdNr.:</strong> ${COMPANY.vat_id}</span>
      <span><strong>Bank:</strong> ${COMPANY.bank_name}</span>
    </div>
    <div class="footer-row">
      <span><strong>Tel:</strong> ${COMPANY.phone}</span>
      <span><strong>IBAN:</strong> ${COMPANY.iban}</span>
    </div>
    <div class="footer-center">
      ${COMPANY.legal_name} · ${COMPANY.address.street} · ${COMPANY.address.zip} ${COMPANY.address.city} · Deutschland
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Export types for use in API routes
export type { InvoiceData };
