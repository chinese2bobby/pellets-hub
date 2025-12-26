import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getOrderById, updateOrder, insertEvent, insertOutboxEntry, updateOutboxEntry } from '@/lib/memory-store';
import { EmailType, Order, OrderEvent, EmailOutbox, Salutation } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { COMPANY, COUNTRY_CONFIG } from '@/config';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'bestellung@pelletor.de';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Pelletor';

interface SendEmailRequest {
  orderId: string;
  templateType: EmailType;
  customSubject?: string;
  customBody?: string;
  attachInvoice?: boolean;
}

// Get proper salutation based on customer data
function getSalutation(salutation: Salutation | undefined, customerName: string): string {
  const lastName = customerName.split(' ').pop() || customerName;

  switch (salutation) {
    case 'herr':
      return `Sehr geehrter Herr ${lastName}`;
    case 'frau':
      return `Sehr geehrte Frau ${lastName}`;
    case 'firma':
      return 'Sehr geehrte Damen und Herren';
    case 'divers':
      return `Guten Tag ${customerName}`;
    default:
      return `Guten Tag ${customerName}`;
  }
}

// Generate email HTML based on template type
function generateEmailHTML(
  templateType: EmailType,
  order: Order,
  customSubject?: string,
  customBody?: string
): { subject: string; html: string } {
  const salutation = getSalutation(order.salutation, order.customer_name);
  const config = COUNTRY_CONFIG[order.country];
  const firstName = order.customer_name.split(' ')[0];

  // Common styles
  const styles = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2D5016; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e5e5e5; }
    .footer { background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .order-box { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .highlight { color: #2D5016; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px; border-bottom: 2px solid #2D5016; }
    td { padding: 10px; border-bottom: 1px solid #eee; }
  `;

  const footerHtml = `
    <div class="footer">
      <p>${COMPANY.legal_name}</p>
      <p>${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}</p>
      <p>${COMPANY.email} | ${COMPANY.phone}</p>
    </div>
  `;

  // Items table for order-related emails
  const itemsHtml = order.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align: center;">${item.quantity} ${item.unit}</td>
      <td style="text-align: right;">${formatCurrency(item.line_total_net, order.country)}</td>
    </tr>
  `).join('');

  const totalsHtml = `
    <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #2D5016;">
      <table>
        <tr>
          <td>Zwischensumme (netto)</td>
          <td style="text-align: right;">${formatCurrency(order.totals.subtotal_net, order.country)}</td>
        </tr>
        <tr>
          <td>${config.vat_label} (${(config.vat_rate * 100).toFixed(0)}%)</td>
          <td style="text-align: right;">${formatCurrency(order.totals.vat_amount, order.country)}</td>
        </tr>
        <tr style="font-weight: bold; font-size: 1.1em;">
          <td>Gesamtbetrag</td>
          <td style="text-align: right; color: #2D5016;">${formatCurrency(order.totals.total_gross, order.country)}</td>
        </tr>
      </table>
    </div>
  `;

  switch (templateType) {
    case 'confirmation':
      return {
        subject: `Bestellbestätigung ${order.order_no} - ${COMPANY.name}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${styles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✅ Bestellung bestätigt</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${order.order_no}</p>
    </div>
    <div class="content">
      <p>${salutation},</p>
      <p>vielen Dank für Ihre Bestellung bei ${COMPANY.name}! Hier sind Ihre Bestelldetails:</p>

      <div class="order-box">
        <h3 style="margin-top: 0;">Lieferadresse</h3>
        <p>
          ${order.customer_name}<br>
          ${order.delivery_address.street} ${order.delivery_address.house_no}<br>
          ${order.delivery_address.zip} ${order.delivery_address.city}<br>
          ${order.country === 'AT' ? 'Österreich' : 'Deutschland'}
        </p>
      </div>

      <div class="order-box">
        <h3 style="margin-top: 0;">Ihre Bestellung</h3>
        <table>
          <thead>
            <tr>
              <th>Produkt</th>
              <th style="text-align: center;">Menge</th>
              <th style="text-align: right;">Preis</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        ${totalsHtml}
      </div>

      <p>Wir werden Sie über den Lieferstatus informieren.</p>
      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    ${footerHtml}
  </div>
</body>
</html>`,
      };

    case 'payment_instructions':
      return {
        subject: `Zahlungsinformationen für Bestellung ${order.order_no}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${styles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">💳 Zahlungsinformationen</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${order.order_no}</p>
    </div>
    <div class="content">
      <p>${salutation},</p>

      <div class="order-box" style="background: #fff3cd; border-color: #ffc107;">
        <p style="margin: 0;"><strong>⏰ Bitte überweisen Sie den Betrag innerhalb von 7 Tagen</strong></p>
        <p style="margin: 10px 0 0 0; font-size: 1.3em; color: #2D5016;"><strong>${formatCurrency(order.totals.total_gross, order.country)}</strong></p>
      </div>

      <div class="order-box">
        <h3 style="margin-top: 0;">Bankverbindung</h3>
        <table>
          <tr><td><strong>Empfänger:</strong></td><td>${COMPANY.payment_recipient}</td></tr>
          <tr><td><strong>IBAN:</strong></td><td><code>${COMPANY.iban}</code></td></tr>
          <tr><td><strong>BIC:</strong></td><td><code>${COMPANY.bic}</code></td></tr>
          <tr><td><strong>Bank:</strong></td><td>${COMPANY.bank_name}</td></tr>
          <tr><td><strong>Verwendungszweck:</strong></td><td><code style="color: #2D5016; font-weight: bold;">${order.order_no}</code></td></tr>
        </table>
      </div>

      <p>⚠️ <strong>Wichtig:</strong> Bitte geben Sie die Bestellnummer als Verwendungszweck an!</p>
      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    ${footerHtml}
  </div>
</body>
</html>`,
      };

    case 'invoice':
      const invoiceNo = `RE-${order.country}-${order.order_seq}`;
      const today = new Date().toLocaleDateString('de-DE');
      return {
        subject: `Rechnung ${invoiceNo} zu Bestellung ${order.order_no}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${styles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📄 Rechnung</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${invoiceNo}</p>
    </div>
    <div class="content">
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <p><strong>Rechnungsempfänger:</strong></p>
          <p>
            ${order.company_name ? order.company_name + '<br>' : ''}
            ${order.customer_name}<br>
            ${order.delivery_address.street} ${order.delivery_address.house_no}<br>
            ${order.delivery_address.zip} ${order.delivery_address.city}<br>
            ${order.country === 'AT' ? 'Österreich' : 'Deutschland'}
            ${order.vat_id ? '<br>USt-IdNr: ' + order.vat_id : ''}
          </p>
        </div>
        <div style="text-align: right;">
          <p><strong>Rechnungsdatum:</strong> ${today}</p>
          <p><strong>Bestellnummer:</strong> ${order.order_no}</p>
          <p><strong>Rechnungsnummer:</strong> ${invoiceNo}</p>
        </div>
      </div>

      <p>${salutation},</p>
      <p>anbei erhalten Sie die Rechnung zu Ihrer Bestellung:</p>

      <div class="order-box">
        <table>
          <thead>
            <tr>
              <th>Pos.</th>
              <th>Bezeichnung</th>
              <th style="text-align: center;">Menge</th>
              <th style="text-align: right;">Einzelpreis</th>
              <th style="text-align: right;">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.quantity} ${item.unit}</td>
                <td style="text-align: right;">${formatCurrency(item.unit_price_net, order.country)}</td>
                <td style="text-align: right;">${formatCurrency(item.line_total_net, order.country)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${totalsHtml}
      </div>

      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    ${footerHtml}
  </div>
</body>
</html>`,
      };

    case 'shipped':
      return {
        subject: `Ihre Bestellung ${order.order_no} wurde versandt 🚚`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${styles}</style></head>
<body>
  <div class="container">
    <div class="header" style="background: #7c3aed;">
      <h1 style="margin: 0;">🚚 Bestellung versandt</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${order.order_no}</p>
    </div>
    <div class="content">
      <p>${salutation},</p>
      <p>gute Nachrichten! Ihre Bestellung <strong>${order.order_no}</strong> wurde versandt und ist auf dem Weg zu Ihnen.</p>

      <div class="order-box">
        <h3 style="margin-top: 0;">Lieferadresse</h3>
        <p>
          ${order.customer_name}<br>
          ${order.delivery_address.street} ${order.delivery_address.house_no}<br>
          ${order.delivery_address.zip} ${order.delivery_address.city}
        </p>
      </div>

      <p>Sie erhalten eine weitere Benachrichtigung, sobald die Lieferung zugestellt wurde.</p>
      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    ${footerHtml}
  </div>
</body>
</html>`,
      };

    case 'delivered':
      return {
        subject: `Ihre Bestellung ${order.order_no} wurde zugestellt ✅`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${styles}</style></head>
<body>
  <div class="container">
    <div class="header" style="background: #16a34a;">
      <h1 style="margin: 0;">✅ Bestellung zugestellt</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${order.order_no}</p>
    </div>
    <div class="content">
      <p>${salutation},</p>
      <p>Ihre Bestellung <strong>${order.order_no}</strong> wurde erfolgreich zugestellt!</p>
      <p>Wir hoffen, dass Sie mit Ihren Holzpellets zufrieden sind. Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
      <p>Vielen Dank für Ihr Vertrauen!</p>
      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    ${footerHtml}
  </div>
</body>
</html>`,
      };

    case 'cancelled':
      return {
        subject: `Bestellung ${order.order_no} wurde storniert`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${styles}</style></head>
<body>
  <div class="container">
    <div class="header" style="background: #dc2626;">
      <h1 style="margin: 0;">❌ Bestellung storniert</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${order.order_no}</p>
    </div>
    <div class="content">
      <p>${salutation},</p>
      <p>Ihre Bestellung <strong>${order.order_no}</strong> wurde storniert.</p>
      <p>Falls Sie bereits bezahlt haben, wird der Betrag von <strong>${formatCurrency(order.totals.total_gross, order.country)}</strong> innerhalb von 5-7 Werktagen zurückerstattet.</p>
      <p>Bei Fragen kontaktieren Sie uns bitte unter ${COMPANY.email}.</p>
      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    ${footerHtml}
  </div>
</body>
</html>`,
      };

    case 'custom':
      // Replace variables in custom body
      const processedBody = (customBody || '')
        .replace(/\{kunde\}/g, order.customer_name)
        .replace(/\{bestellnummer\}/g, order.order_no)
        .replace(/\{betrag\}/g, formatCurrency(order.totals.total_gross, order.country))
        .replace(/\{anrede\}/g, salutation);

      return {
        subject: customSubject || `Bestellung ${order.order_no} - ${COMPANY.name}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${styles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🌲 ${COMPANY.name}</h1>
    </div>
    <div class="content">
      <p>${salutation},</p>
      <div style="white-space: pre-wrap;">${processedBody}</div>
      <p style="margin-top: 20px;">Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    ${footerHtml}
  </div>
</body>
</html>`,
      };

    default:
      return {
        subject: `Bestellung ${order.order_no}`,
        html: `<p>Email type not supported: ${templateType}</p>`,
      };
  }
}

// Map template type to email flag
function getEmailFlagKey(templateType: EmailType): keyof Order['email_flags'] | null {
  switch (templateType) {
    case 'confirmation': return 'confirmation_sent';
    case 'payment_instructions': return 'payment_instructions_sent';
    case 'weekend_hello': return 'weekend_hello_sent';
    case 'shipped': return 'shipped_sent';
    case 'delivered': return 'delivered_sent';
    case 'cancelled': return 'cancelled_sent';
    default: return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();
    const { orderId, templateType, customSubject, customBody, attachInvoice } = body;

    if (!orderId || !templateType) {
      return NextResponse.json(
        { success: false, error: 'orderId and templateType are required' },
        { status: 400 }
      );
    }

    const order = getOrderById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Generate email content
    const { subject, html } = generateEmailHTML(templateType, order, customSubject, customBody);

    // Create outbox entry
    const outboxId = crypto.randomUUID();
    const outbox: EmailOutbox = {
      id: outboxId,
      order_id: orderId,
      email_type: templateType,
      to_email: order.email,
      payload: { subject, customSubject, customBody, attachInvoice },
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    insertOutboxEntry(outbox);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: order.email,
      subject,
      html,
      // TODO: Add PDF attachment when attachInvoice is true
    });

    if (error) {
      updateOutboxEntry(outboxId, { status: 'failed', error_message: error.message });
      console.error(`❌ Email failed (${templateType}) to ${order.email}:`, error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Update outbox
    updateOutboxEntry(outboxId, { status: 'sent', sent_at: new Date().toISOString() });

    // Update email flags on order
    const flagKey = getEmailFlagKey(templateType);
    if (flagKey) {
      updateOrder(orderId, {
        email_flags: {
          ...order.email_flags,
          [flagKey]: true,
          [`${flagKey}_at`]: new Date().toISOString(),
        },
      });
    }

    // Create event
    const event: OrderEvent = {
      id: crypto.randomUUID(),
      order_id: orderId,
      actor_type: 'admin',
      event_type: 'email_sent',
      payload: {
        email_type: templateType,
        message_id: data?.id,
        subject,
        to: order.email,
      },
      created_at: new Date().toISOString(),
    };
    insertEvent(event);

    console.log(`✅ Email sent (${templateType}) to ${order.email}: ${data?.id}`);

    return NextResponse.json({
      success: true,
      data: {
        messageId: data?.id,
        emailType: templateType,
        to: order.email,
      },
      message: `E-Mail (${templateType}) erfolgreich gesendet`,
    });

  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
