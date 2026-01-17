// Invoice HTML Generator - Pelletor
// Corporate professional design for German/Austrian customers

import { Order, Salutation } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { COMPANY } from '@/config';

export interface InvoiceData {
  invoiceNo: string;
  order: Order;
  generatedAt: Date;
}

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
    case 'herr': return `Sehr geehrter Herr ${lastName}`;
    case 'frau': return `Sehr geehrte Frau ${lastName}`;
    case 'divers': return `Guten Tag ${customerName}`;
    default: return `Guten Tag ${customerName}`;
  }
}

export function generateInvoiceNo(order: Order): string {
  const year = new Date().getFullYear();
  return `RE-${order.country}-${year}-${String(order.order_seq).padStart(6, '0')}`;
}

function formatDateDE(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function generateEpcQrUrl(
  amount: number,
  reference: string,
  iban: string,
  bic: string,
  recipient: string
): string {
  const amountStr = (amount / 100).toFixed(2);
  const epcData = [
    'BCD', '002', '1', 'SCT',
    bic.replace(/\s/g, ''),
    recipient.substring(0, 70),
    iban.replace(/\s/g, ''),
    `EUR${amountStr}`,
    '', '', reference.substring(0, 140), ''
  ].join('\n');
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(epcData)}`;
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const { invoiceNo, order, generatedAt } = data;
  const hasCompany = Boolean(order.company_name);
  const salutation = getSalutation(order.salutation, order.customer_name, hasCompany);
  const isReverseCharge = order.totals.is_reverse_charge === true;

  const subtotalNet = order.totals.subtotal_net;
  const vatAmount = order.totals.vat_amount;
  const totalGross = order.totals.total_gross;
  const vatRate = order.totals.vat_rate;
  const vatLabel = order.totals.vat_label;

  // Payment method labels
  const paymentMethodLabels: Record<string, string> = {
    vorkasse: 'Vorkasse (Überweisung)',
    lastschrift: 'SEPA-Lastschrift',
    paypal: 'PayPal',
    klarna: 'Klarna',
    rechnung: 'Kauf auf Rechnung'
  };
  const paymentMethodLabel = paymentMethodLabels[order.payment_method] || order.payment_method;

  // For "rechnung" payment - 50% prepayment for new customers
  const isRechnungPayment = order.payment_method === 'rechnung';
  const prepaymentAmount = isRechnungPayment ? Math.round(totalGross * 0.5) : totalGross;
  const amountToPay = order.payment_method === 'vorkasse' ? totalGross : prepaymentAmount;

  // QR code only for vorkasse (full amount) and rechnung (50% prepayment)
  const showQrCode = order.payment_method === 'vorkasse' || order.payment_method === 'rechnung';
  const qrCodeUrl = showQrCode
    ? generateEpcQrUrl(amountToPay, `RE ${order.order_no}`, COMPANY.iban, COMPANY.bic, COMPANY.payment_recipient)
    : null;

  // Show bank details for: vorkasse, rechnung, lastschrift (no QR for lastschrift)
  const showBankDetails = ['vorkasse', 'rechnung', 'lastschrift'].includes(order.payment_method);

  const getBankDetailsHtml = (showQr = false, amountLabel = 'Betrag', amount = totalGross) => `
    <div class="${showQr ? 'bank-with-qr' : ''}">
      <table class="bank-details">
        <tr><td class="label">Empfänger:</td><td>${COMPANY.payment_recipient}</td></tr>
        <tr><td class="label">IBAN:</td><td class="mono">${COMPANY.iban}</td></tr>
        <tr><td class="label">BIC:</td><td class="mono">${COMPANY.bic}</td></tr>
        <tr><td class="label">Verwendungszweck:</td><td class="ref">${order.order_no}</td></tr>
        <tr><td class="label">${amountLabel}:</td><td class="ref">${formatCurrency(amount, order.country)}</td></tr>
      </table>
      ${showQr && qrCodeUrl ? `
      <div class="qr-inline">
        <img src="${qrCodeUrl}" alt="QR" />
        <span class="qr-label">GiroCode</span>
        <span class="qr-hint">Scannen Sie den Code<br>in Ihrer Banking-App</span>
      </div>
      ` : ''}
    </div>
  `;

  const getPaymentSection = () => {
    // Rechnung (50% prepayment for new customers)
    if (order.payment_method === 'rechnung') {
      return `
        <p class="payment-note" style="margin-bottom: 10px;">
          <strong>Anzahlung (50%):</strong> ${formatCurrency(prepaymentAmount, order.country)}<br>
          <strong>Restbetrag:</strong> ${formatCurrency(totalGross - prepaymentAmount, order.country)} — zahlbar innerhalb von 14 Tagen nach Lieferung.
        </p>
        ${getBankDetailsHtml(true, 'Anzahlung', prepaymentAmount)}
      `;
    }

    // Vorkasse - full amount with QR
    if (order.payment_method === 'vorkasse') {
      return getBankDetailsHtml(true);
    }

    // All other methods (PayPal, Klarna, Lastschrift) - just bank details, no QR
    return getBankDetailsHtml(false);
  };

  const getLegalNotes = () => {
    if (isReverseCharge) {
      return `
        <p><strong>Hinweis zur Steuerschuldumkehr:</strong> Steuerschuldnerschaft des Leistungsempfängers gemäß Art. 196 MwStSystRL. Die Umsatzsteuer ist vom Leistungsempfänger zu entrichten.</p>
        <p>UID-Nr. Leistungsempfänger: ${order.vat_id || '—'} | UID-Nr. Leistungserbringer: ${COMPANY.vat_id}</p>
      `;
    }
    if (order.country === 'AT') {
      return `<p>Leistungszeitraum entspricht dem Lieferdatum. Rechnungsbetrag enthält 20% USt.</p>`;
    }
    return `<p>Leistungszeitraum entspricht dem Lieferdatum. Auf Holzpellets wird der ermäßigte Steuersatz von 7% angewandt (§ 12 Abs. 2 Nr. 1 UStG).</p>`;
  };

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${invoiceNo}</title>
  <style>
    @page { margin: 15mm 12mm; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      line-height: 1.4;
      color: #1a1a1a;
      background: #fff;
      max-width: 210mm;
      margin: 0 auto;
    }
    @media screen { body { padding: 10mm; } }
    @media print { body { padding: 0; } }

    /* Header */
    .header {
      background: #1e3a3a;
      color: #fff;
      padding: 20px 24px;
      margin: -10mm -10mm 0 -10mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    @media print { .header { margin: 0; } }
    .header-logo img {
      height: 36px;
      width: auto;
    }
    .header-company {
      text-align: right;
      font-size: 8pt;
      opacity: 0.9;
      line-height: 1.5;
    }
    .header-company strong {
      font-size: 10pt;
      display: block;
      margin-bottom: 4px;
    }

    /* Document Info */
    .doc-info {
      margin: 24px 0;
      display: flex;
      justify-content: space-between;
    }
    .doc-title {
      font-size: 20pt;
      font-weight: bold;
      color: #1e3a3a;
      letter-spacing: -0.5px;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-meta table {
      font-size: 9pt;
      border-collapse: collapse;
    }
    .doc-meta td {
      padding: 2px 0;
    }
    .doc-meta .label {
      color: #666;
      padding-right: 16px;
    }
    .doc-meta .value {
      font-weight: 600;
      text-align: right;
    }

    /* Address Block */
    .address-section {
      margin: 20px 0 24px;
      display: flex;
      gap: 40px;
    }
    .address-block {
      flex: 1;
    }
    .address-label {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .address-block p {
      margin: 2px 0;
    }
    .address-block .name {
      font-weight: 600;
      font-size: 10pt;
    }
    .address-block .company {
      font-weight: 700;
      color: #1e3a3a;
    }
    .address-block .vat {
      font-size: 8pt;
      color: #666;
      margin-top: 6px;
    }

    /* Greeting */
    .greeting {
      margin: 20px 0;
      font-size: 9pt;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 9pt;
    }
    .items-table th {
      background: #1e3a3a;
      color: #fff;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .items-table th.r { text-align: right; }
    .items-table th.c { text-align: center; }
    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e5e5;
      vertical-align: top;
    }
    .items-table td.r { text-align: right; }
    .items-table td.c { text-align: center; }
    .items-table .item-name { font-weight: 500; }
    .items-table .item-sku { font-size: 8pt; color: #888; }
    .items-table tfoot td {
      padding: 8px 12px;
      border-bottom: none;
      background: #fafafa;
    }
    .items-table .subtotal-row td {
      font-size: 9pt;
      color: #555;
    }
    .items-table .total-row td {
      background: #f0f0f0;
      color: #1a1a1a;
      font-size: 11pt;
      padding: 12px;
      border-top: 2px solid #1e3a3a;
    }
    .items-table .total-row td strong {
      font-weight: 700;
    }

    /* Payment Section */
    .payment-section {
      margin: 20px 0;
      padding: 12px 16px;
      background: #fafafa;
      border: 1px dashed #bbb;
    }
    .payment-section h4 {
      font-size: 9pt;
      margin-bottom: 8px;
      color: #1e3a3a;
      font-weight: 600;
    }
    .bank-details {
      font-size: 10pt;
      border-collapse: collapse;
    }
    .bank-details td {
      padding: 2px 0;
      font-weight: 400;
      color: #1a1a1a;
    }
    .bank-details .label {
      color: #555;
      width: 130px;
      padding-right: 12px;
    }
    .bank-details .mono {
      letter-spacing: 0.3px;
    }
    .bank-details .ref {
      font-weight: 600;
    }
    .payment-note {
      font-size: 9pt;
      color: #444;
    }
    .bank-with-qr {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .qr-inline {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .qr-inline img {
      width: 90px;
      height: 90px;
      border: 2px solid #1e3a3a;
      padding: 4px;
      background: #fff;
    }
    .qr-inline .qr-label {
      font-size: 9pt;
      font-weight: 700;
      color: #1e3a3a;
    }
    .qr-inline .qr-hint {
      font-size: 7pt;
      color: #666;
      text-align: center;
      line-height: 1.4;
    }


    /* Legal Notes */
    .legal-notes {
      margin: 20px 0;
      padding: 12px;
      background: #f9f9f9;
      border-left: 2px solid #ccc;
      font-size: 8pt;
      color: #555;
      line-height: 1.5;
    }
    .legal-notes.reverse-charge {
      background: #fff8e6;
      border-color: #e6a700;
      color: #8a6500;
    }

    /* Terms */
    .terms {
      margin: 16px 0;
      font-size: 8pt;
      color: #666;
    }


    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      font-size: 7pt;
      color: #888;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .footer-col { flex: 1; min-width: 150px; }
    .footer-col strong { color: #666; }
    .footer-center {
      width: 100%;
      text-align: center;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #eee;
      font-size: 7pt;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="header-logo">
      <img src="${COMPANY.logo_url}" alt="${COMPANY.name}" onerror="this.outerHTML='<span style=font-size:16pt;font-weight:bold>PELLETOR</span>'" />
    </div>
    <div class="header-company">
      <strong>${COMPANY.legal_name}</strong>
      ${COMPANY.address.street} · ${COMPANY.address.zip} ${COMPANY.address.city}
    </div>
  </div>

  <!-- Document Info -->
  <div class="doc-info">
    <div class="doc-title">RECHNUNG</div>
    <div class="doc-meta">
      <table>
        <tr><td class="label">Rechnungsnummer:</td><td class="value">${invoiceNo}</td></tr>
        <tr><td class="label">Rechnungsdatum:</td><td class="value">${formatDateDE(generatedAt)}</td></tr>
        <tr><td class="label">Bestellnummer:</td><td class="value">${order.order_no}</td></tr>
        <tr><td class="label">Zahlungsart:</td><td class="value">${paymentMethodLabel}</td></tr>
        ${order.delivery_date ? `<tr><td class="label">Lieferdatum:</td><td class="value">${formatDateDE(new Date(order.delivery_date))}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <!-- Address Section -->
  <div class="address-section">
    <div class="address-block">
      <div class="address-label">Rechnungsadresse</div>
      ${order.company_name ? `<p class="company">${order.company_name}</p>` : ''}
      <p class="name">${order.customer_name}</p>
      <p>${order.delivery_address.street} ${order.delivery_address.house_no}</p>
      <p>${order.delivery_address.zip} ${order.delivery_address.city}</p>
      <p>${order.country === 'AT' ? 'Österreich' : 'Deutschland'}</p>
      ${order.vat_id ? `<p class="vat">UID-Nr.: ${order.vat_id}</p>` : ''}
    </div>
    <div class="address-block">
      <div class="address-label">Lieferadresse</div>
      ${order.company_name ? `<p class="company">${order.company_name}</p>` : ''}
      <p class="name">${order.customer_name}</p>
      <p>${order.delivery_address.street} ${order.delivery_address.house_no}</p>
      <p>${order.delivery_address.zip} ${order.delivery_address.city}</p>
      <p>${order.country === 'AT' ? 'Österreich' : 'Deutschland'}</p>
    </div>
  </div>

  <!-- Greeting -->
  <div class="greeting">
    <p>${salutation},</p>
    <p>vielen Dank für Ihre Bestellung. Wir berechnen Ihnen wie folgt:</p>
  </div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:8%">Pos.</th>
        <th style="width:42%">Bezeichnung</th>
        <th class="c" style="width:12%">Menge</th>
        <th class="r" style="width:19%">Einzelpreis</th>
        <th class="r" style="width:19%">Gesamtpreis</th>
      </tr>
    </thead>
    <tbody>
      ${order.items.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div class="item-name">${item.name}</div>
            <div class="item-sku">Art.-Nr. ${item.sku}</div>
          </td>
          <td class="c">${item.quantity} ${item.unit === 'palette' ? 'Palette(n)' : item.unit}</td>
          <td class="r">${formatCurrency(item.unit_price_net, order.country)}</td>
          <td class="r">${formatCurrency(item.line_total_net, order.country)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr class="subtotal-row">
        <td colspan="4" class="r">Nettobetrag</td>
        <td class="r">${formatCurrency(subtotalNet, order.country)}</td>
      </tr>
      ${order.totals.shipping_net > 0 ? `
      <tr class="subtotal-row">
        <td colspan="4" class="r">Versand</td>
        <td class="r">${formatCurrency(order.totals.shipping_net, order.country)}</td>
      </tr>
      ` : ''}
      ${isReverseCharge ? `
      <tr class="subtotal-row">
        <td colspan="4" class="r">${vatLabel}</td>
        <td class="r">0,00 €</td>
      </tr>
      ` : `
      <tr class="subtotal-row">
        <td colspan="4" class="r">${vatLabel} ${(vatRate * 100).toFixed(0)}%</td>
        <td class="r">${formatCurrency(vatAmount, order.country)}</td>
      </tr>
      `}
      <tr class="total-row">
        <td colspan="4" class="r"><strong>Gesamtbetrag</strong></td>
        <td class="r"><strong>${formatCurrency(totalGross, order.country)}</strong></td>
      </tr>
    </tfoot>
  </table>

  <!-- Payment Section -->
  <div class="payment-section">
    <h4>Zahlungsinformationen</h4>
    ${getPaymentSection()}
  </div>

  <!-- Legal Notes -->
  <div class="legal-notes${isReverseCharge ? ' reverse-charge' : ''}">
    ${getLegalNotes()}
  </div>

  <!-- Terms -->
  <div class="terms">
    <p>Zahlungsziel: 14 Tage nach Rechnungsdatum. Bitte geben Sie bei der Überweisung die Bestellnummer als Verwendungszweck an.</p>
  </div>


  <!-- Footer -->
  <div class="footer">
    <div class="footer-col">
      <strong>${COMPANY.ceo_title}:</strong> ${COMPANY.ceo}<br>
      <strong>USt-IdNr.:</strong> ${COMPANY.vat_id}
    </div>
    <div class="footer-col">
      <strong>Handelsregister:</strong> ${COMPANY.company_register}<br>
      <strong>Registergericht:</strong> ${COMPANY.register_court}
    </div>
    <div class="footer-col">
      <strong>Bank:</strong> ${COMPANY.bank_name}<br>
      <strong>IBAN:</strong> ${COMPANY.iban}
    </div>
    <div class="footer-center">
      ${COMPANY.legal_name} · ${COMPANY.address.street} · ${COMPANY.address.zip} ${COMPANY.address.city} · Tel: ${COMPANY.phone} · ${COMPANY.email}
    </div>
  </div>
</body>
</html>
  `.trim();
}

export type { InvoiceData };
