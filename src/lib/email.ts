// Resend Email Integration - Mastermind Edition 🧠
import { Resend } from 'resend';
import { Order, EmailType } from '@/types';
import { formatCurrency } from './utils';
import { COMPANY, COUNTRY_CONFIG } from '@/config';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'bestellung@pelletor.at';
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Pelletor';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================
// EMAIL TEMPLATES
// ============================================

function getWeekendHelloEmail(order: Order): { subject: string; html: string } {
  const firstName = order.customer_name.split(' ')[0];
  
  return {
    subject: `Hallo ${firstName}! Ihre Bestellung ${order.order_no} ist eingegangen 🌲`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2D5016; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e5e5e5; }
    .footer { background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .order-box { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .highlight { color: #2D5016; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🌲 ${COMPANY.name}</h1>
    </div>
    <div class="content">
      <h2>Hallo ${firstName}!</h2>
      <p>Vielen Dank für Ihre Bestellung bei ${COMPANY.name}!</p>
      <p>Wir haben Ihre Bestellung am Wochenende erhalten und werden sie am nächsten Werktag bearbeiten.</p>
      
      <div class="order-box">
        <p><strong>Bestellnummer:</strong> <span class="highlight">${order.order_no}</span></p>
        <p><strong>Datum:</strong> ${new Date(order.created_at).toLocaleDateString('de-AT')}</p>
        <p><strong>Gesamtbetrag:</strong> ${formatCurrency(order.totals.total_gross, order.country)}</p>
      </div>
      
      <p>Sie erhalten in Kürze eine Bestätigung mit allen Details.</p>
      <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung!</p>
      
      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    <div class="footer">
      <p>${COMPANY.legal_name}</p>
      <p>${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}</p>
      <p>${COMPANY.email} | ${COMPANY.phone}</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

function getConfirmationEmail(order: Order): { subject: string; html: string } {
  const firstName = order.customer_name.split(' ')[0];
  const countryConfig = COUNTRY_CONFIG[order.country];
  
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(item.line_total_net, order.country)}</td>
    </tr>
  `).join('');

  return {
    subject: `Bestellbestätigung ${order.order_no} - ${COMPANY.name}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2D5016; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e5e5e5; }
    .footer { background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .order-box { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .highlight { color: #2D5016; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px; border-bottom: 2px solid #2D5016; }
    .totals { margin-top: 15px; padding-top: 15px; border-top: 2px solid #2D5016; }
    .totals td { padding: 5px 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✅ Bestellung bestätigt</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${order.order_no}</p>
    </div>
    <div class="content">
      <h2>Hallo ${firstName}!</h2>
      <p>Vielen Dank für Ihre Bestellung! Hier sind Ihre Bestelldetails:</p>
      
      <div class="order-box">
        <h3 style="margin-top: 0;">Lieferadresse</h3>
        <p>
          ${order.customer_name}<br>
          ${order.delivery_address.street} ${order.delivery_address.house_no}<br>
          ${order.delivery_address.zip} ${order.delivery_address.city}
        </p>
        ${order.delivery_notes ? `<p><em>Hinweis: ${order.delivery_notes}</em></p>` : ''}
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
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="totals">
          <table>
            <tr>
              <td>Zwischensumme (netto)</td>
              <td style="text-align: right;">${formatCurrency(order.totals.subtotal_net, order.country)}</td>
            </tr>
            <tr>
              <td>${order.totals.vat_label} (${(order.totals.vat_rate * 100).toFixed(0)}%)</td>
              <td style="text-align: right;">${formatCurrency(order.totals.vat_amount, order.country)}</td>
            </tr>
            <tr style="font-weight: bold; font-size: 1.1em;">
              <td>Gesamtbetrag</td>
              <td style="text-align: right; color: #2D5016;">${formatCurrency(order.totals.total_gross, order.country)}</td>
            </tr>
          </table>
        </div>
      </div>
      
      <p>Wir werden Sie über den Lieferstatus informieren.</p>
      <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung!</p>
      
      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    <div class="footer">
      <p>${COMPANY.legal_name}</p>
      <p>${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}</p>
      <p>${COMPANY.email} | ${COMPANY.phone}</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

function getPaymentInstructionsEmail(order: Order): { subject: string; html: string } {
  const firstName = order.customer_name.split(' ')[0];
  
  return {
    subject: `Zahlungsinformationen für Bestellung ${order.order_no}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2D5016; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e5e5e5; }
    .footer { background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .payment-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .bank-details { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .highlight { color: #2D5016; font-weight: bold; }
    code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">💳 Zahlungsinformationen</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${order.order_no}</p>
    </div>
    <div class="content">
      <h2>Hallo ${firstName}!</h2>
      
      <div class="payment-box">
        <p style="margin: 0;"><strong>⏰ Bitte überweisen Sie den Betrag innerhalb von 7 Tagen</strong></p>
        <p style="margin: 10px 0 0 0; font-size: 1.3em; color: #2D5016;"><strong>${formatCurrency(order.totals.total_gross, order.country)}</strong></p>
      </div>
      
      <div class="bank-details">
        <h3 style="margin-top: 0;">Bankverbindung</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 5px 0;"><strong>Empfänger:</strong></td>
            <td>${COMPANY.payment_recipient}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>IBAN:</strong></td>
            <td><code>${COMPANY.iban}</code></td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>BIC:</strong></td>
            <td><code>${COMPANY.bic}</code></td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Bank:</strong></td>
            <td>${COMPANY.bank_name}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Verwendungszweck:</strong></td>
            <td><code style="font-size: 1.1em; color: #2D5016;">${order.order_no}</code></td>
          </tr>
        </table>
      </div>
      
      <p>⚠️ <strong>Wichtig:</strong> Bitte geben Sie die Bestellnummer <code>${order.order_no}</code> als Verwendungszweck an!</p>
      
      <p>Nach Zahlungseingang wird Ihre Bestellung versandt.</p>
      
      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    <div class="footer">
      <p>${COMPANY.legal_name}</p>
      <p>${COMPANY.address.street}, ${COMPANY.address.zip} ${COMPANY.address.city}</p>
      <p>${COMPANY.email} | ${COMPANY.phone}</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

function getCancelledEmail(order: Order): { subject: string; html: string } {
  const firstName = order.customer_name.split(' ')[0];
  
  return {
    subject: `Bestellung ${order.order_no} wurde storniert`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #e5e5e5; }
    .footer { background: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">❌ Bestellung storniert</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${order.order_no}</p>
    </div>
    <div class="content">
      <h2>Hallo ${firstName},</h2>
      <p>Ihre Bestellung <strong>${order.order_no}</strong> wurde storniert.</p>
      
      <p>Falls Sie bereits bezahlt haben, wird der Betrag innerhalb von 5-7 Werktagen zurückerstattet.</p>
      
      <p>Bei Fragen kontaktieren Sie uns bitte unter ${COMPANY.email}.</p>
      
      <p>Mit freundlichen Grüßen,<br>Ihr ${COMPANY.name} Team</p>
    </div>
    <div class="footer">
      <p>${COMPANY.legal_name}</p>
      <p>${COMPANY.email} | ${COMPANY.phone}</p>
    </div>
  </div>
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
      console.error(`❌ Email send failed (${emailType}):`, error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Email sent (${emailType}) to ${order.email}: ${data?.id}`);
    return { success: true, messageId: data?.id };

  } catch (error) {
    console.error(`❌ Email error (${emailType}):`, error);
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

