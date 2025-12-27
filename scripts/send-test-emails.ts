// Send all email variations for review
import { readFileSync } from 'fs';
import { Resend } from 'resend';

// Load .env.local manually
const envFile = readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const resend = new Resend(env.RESEND_API_KEY);
const TO_EMAIL = 'vielgluck2sie@proton.me';
const FROM_EMAIL = env.RESEND_FROM_EMAIL || 'bestellung@pelletor.at';
const FROM_NAME = 'Pelletor Test';

// Fetch email HTML from preview endpoint
async function fetchEmailHtml(type: string, order: string, payment?: string): Promise<string> {
  const url = new URL('http://localhost:3000/api/email-preview');
  url.searchParams.set('type', type);
  url.searchParams.set('order', order);
  if (payment) url.searchParams.set('payment', payment);

  const res = await fetch(url.toString());
  return res.text();
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
      console.error(`❌ Failed: ${subject}`, error.message);
      return false;
    }

    console.log(`✅ Sent: ${subject}`);
    return true;
  } catch (err) {
    console.error(`❌ Error: ${subject}`, err);
    return false;
  }
}

async function main() {
  console.log('📧 Sending all email variations to:', TO_EMAIL);
  console.log('');

  // 1. Confirmation emails with different payment methods
  const paymentMethods = ['vorkasse', 'rechnung', 'klarna', 'paypal', 'lastschrift'];

  for (const payment of paymentMethods) {
    const html = await fetchEmailHtml('confirmation', 'de-b2c', payment);
    await sendEmail(`[TEST] Bestellbestätigung – ${payment.toUpperCase()}`, html);
    await new Promise(r => setTimeout(r, 1000)); // Rate limit
  }

  // 2. Other email types
  const otherTypes = [
    { type: 'shipped', label: 'VERSAND' },
    { type: 'cancelled', label: 'STORNIERT' },
    { type: 'weekend_hello', label: 'WOCHENENDE' },
    { type: 'payment_instructions', label: 'ZAHLUNGSINFO' },
  ];

  for (const { type, label } of otherTypes) {
    const html = await fetchEmailHtml(type, 'de-b2c');
    await sendEmail(`[TEST] ${label}`, html);
    await new Promise(r => setTimeout(r, 1000));
  }

  // 3. AT B2B Reverse Charge example
  const rcHtml = await fetchEmailHtml('confirmation', 'at-b2b-rc', 'vorkasse');
  await sendEmail(`[TEST] Bestellbestätigung – AT REVERSE CHARGE`, rcHtml);

  console.log('');
  console.log('✅ All emails sent!');
}

main().catch(console.error);
