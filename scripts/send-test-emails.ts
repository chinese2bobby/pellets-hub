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
  console.log('📧 Sending email variations to:', TO_EMAIL);
  console.log('');

  const orderTypes = [
    { code: 'de-b2c', label: 'DE B2C' },
    { code: 'de-b2b', label: 'DE B2B' },
    { code: 'at-b2c', label: 'AT B2C' },
    { code: 'at-b2b-rc', label: 'AT B2B (RC)' },
  ];

  const paymentMethods = ['vorkasse', 'rechnung', 'klarna'];

  let count = 0;

  // All order types with all payment methods
  for (const order of orderTypes) {
    for (const payment of paymentMethods) {
      const html = await fetchEmailHtml('confirmation', order.code, payment);
      await sendEmail(`[TEST] ${order.label} – ${payment.toUpperCase()}`, html);
      await new Promise(r => setTimeout(r, 800));
      count++;
    }
  }

  // Weekend hello
  const weekendHtml = await fetchEmailHtml('weekend_hello', 'de-b2c');
  await sendEmail(`[TEST] Eingangsbestätigung – WOCHENENDE`, weekendHtml);
  count++;

  console.log('');
  console.log(`✅ All ${count} emails sent!`);
}

main().catch(console.error);
