'use client';

import { useState } from 'react';
import { Order, EmailType, Salutation } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';

interface EmailComposerProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSend: (result: { success: boolean; error?: string }) => void;
}

// Email template options
const EMAIL_TEMPLATES: { value: EmailType; label: string; description: string }[] = [
  { value: 'confirmation', label: 'Bestellbestätigung', description: 'Bestätigt die Bestellung' },
  { value: 'payment_instructions', label: 'Zahlungsanweisung', description: 'Bankdaten senden' },
  { value: 'weekend_hello', label: 'Wochenend-Begrüßung', description: 'Kurze Bestätigung' },
  { value: 'invoice', label: 'Rechnung', description: 'Rechnung senden' },
  { value: 'shipped', label: 'Versandbestätigung', description: 'Versand mitteilen' },
  { value: 'delivered', label: 'Zustellbestätigung', description: 'Zustellung bestätigen' },
  { value: 'cancelled', label: 'Stornierung', description: 'Storno mitteilen' },
  { value: 'custom', label: 'Benutzerdefiniert', description: 'Eigene Nachricht' },
];

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

// Get email body based on template
function getEmailBody(template: EmailType, order: Order, customBody?: string): string {
  const vatLabel = order.country === 'AT' ? 'USt.' : 'MwSt.';
  const vatRate = order.country === 'AT' ? '20%' : '7%';

  switch (template) {
    case 'confirmation':
      return `vielen Dank für Ihre Bestellung bei Pelletor!\n\nIhre Bestellung ${order.order_no} wurde erfolgreich aufgenommen und wird nun bearbeitet. Sie erhalten in Kürze weitere Informationen zum Lieferstatus.\n\nBestellübersicht:\n• Bestellnummer: ${order.order_no}\n• Gesamtbetrag: ${formatCurrency(order.totals.total_gross, order.country)} (inkl. ${vatRate} ${vatLabel})\n• Zahlungsart: ${order.payment_method === 'vorkasse' ? 'Vorkasse' : order.payment_method === 'paypal' ? 'PayPal' : order.payment_method === 'klarna' ? 'Klarna' : 'Lastschrift'}`;
    case 'payment_instructions':
      return `hier sind Ihre Zahlungsinformationen für Bestellung ${order.order_no}.\n\nBitte überweisen Sie den Betrag von ${formatCurrency(order.totals.total_gross, order.country)} innerhalb von 7 Tagen auf folgendes Konto:\n\nEmpfänger: Or Projekt GmbH\nIBAN: DE89 2175 0000 0017 2838 00\nBIC: NOLADE21NOS\nBank: Nord-Ostsee Sparkasse\nVerwendungszweck: ${order.order_no}\n\nNach Zahlungseingang wird Ihre Bestellung umgehend versendet.`;
    case 'weekend_hello':
      return `vielen Dank für Ihre Bestellung bei Pelletor!\n\nWir haben Ihre Bestellung ${order.order_no} am Wochenende erhalten und werden diese am nächsten Werktag bearbeiten.\n\nSie erhalten dann eine ausführliche Bestätigung mit allen Details.`;
    case 'invoice':
      return `anbei finden Sie die Rechnung zu Ihrer Bestellung ${order.order_no}.\n\nRechnungsdetails:\n• Rechnungsbetrag: ${formatCurrency(order.totals.total_gross, order.country)}\n• Davon ${vatRate} ${vatLabel}: ${formatCurrency(order.totals.vat_amount, order.country)}\n• Zahlungsziel: 14 Tage`;
    case 'shipped':
      return `gute Nachrichten! Ihre Bestellung ${order.order_no} wurde versandt und ist auf dem Weg zu Ihnen.\n\nVoraussichtliche Lieferung: In 2-4 Werktagen\n\nBitte stellen Sie sicher, dass die Zufahrt für unser Lieferfahrzeug frei ist. Der Fahrer wird Sie ca. 30 Minuten vor Ankunft telefonisch kontaktieren.`;
    case 'delivered':
      return `Ihre Bestellung ${order.order_no} wurde erfolgreich zugestellt.\n\nWir hoffen, Sie sind zufrieden mit Ihren Holzpellets! Bei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nWir würden uns freuen, wenn Sie uns weiterempfehlen.`;
    case 'cancelled':
      return `Ihre Bestellung ${order.order_no} wurde storniert.\n\nFalls Sie bereits bezahlt haben, wird der Betrag von ${formatCurrency(order.totals.total_gross, order.country)} innerhalb von 5-7 Werktagen auf Ihr Konto zurückerstattet.\n\nBei Fragen kontaktieren Sie uns gerne.`;
    case 'custom':
      return customBody || '';
    default:
      return '';
  }
}

// Get subject based on template
function getSubject(template: EmailType, orderNo: string, customSubject?: string): string {
  switch (template) {
    case 'confirmation':
      return `Bestellbestätigung ${orderNo} - Pelletor`;
    case 'payment_instructions':
      return `Zahlungsinformationen für Bestellung ${orderNo}`;
    case 'weekend_hello':
      return `Ihre Bestellung ${orderNo} ist eingegangen`;
    case 'invoice':
      return `Rechnung zu Bestellung ${orderNo}`;
    case 'shipped':
      return `Ihre Bestellung ${orderNo} wurde versandt`;
    case 'delivered':
      return `Ihre Bestellung ${orderNo} wurde zugestellt`;
    case 'cancelled':
      return `Bestellung ${orderNo} wurde storniert`;
    case 'custom':
      return customSubject || `Bestellung ${orderNo}`;
    default:
      return `Bestellung ${orderNo}`;
  }
}

export function EmailComposer({ order, isOpen, onClose, onSend }: EmailComposerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailType>('confirmation');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [attachInvoice, setAttachInvoice] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const salutation = getSalutation(order.salutation, order.customer_name);
  const subject = getSubject(selectedTemplate, order.order_no, customSubject);
  const body = getEmailBody(selectedTemplate, order, customBody);

  const handleSend = async () => {
    setIsSending(true);

    try {
      const response = await fetch('/api/orders/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          templateType: selectedTemplate,
          customSubject: selectedTemplate === 'custom' ? customSubject : undefined,
          customBody: selectedTemplate === 'custom' ? customBody : undefined,
          attachInvoice,
        }),
      });

      const result = await response.json();
      onSend(result);

      if (result.success) {
        onClose();
      }
    } catch (error) {
      onSend({ success: false, error: String(error) });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span>📧</span>
            <span>E-Mail senden</span>
            <span className="text-sm font-normal text-gray-500">({order.order_no})</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Left: Settings */}
          <div className="space-y-4">
            {/* Order Info */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Kunde:</span>
                <span className="font-medium">{order.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">E-Mail:</span>
                <span className="font-medium">{order.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Land:</span>
                <span>{order.country === 'AT' ? 'Österreich' : 'Deutschland'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Betrag:</span>
                <span className="font-medium text-green-700">{formatCurrency(order.totals.total_gross, order.country)}</span>
              </div>
            </div>

            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Vorlage</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value as EmailType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {EMAIL_TEMPLATES.map((template) => (
                  <option key={template.value} value={template.value}>
                    {template.label} - {template.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Fields */}
            {selectedTemplate === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Betreff</label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="E-Mail Betreff..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Nachricht</label>
                  <textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    placeholder="Ihre Nachricht..."
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </>
            )}

            {/* Invoice Attachment */}
            {(selectedTemplate === 'confirmation' || selectedTemplate === 'invoice' || selectedTemplate === 'custom') && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachInvoice}
                  onChange={(e) => setAttachInvoice(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm">Rechnung als PDF anhängen</span>
              </label>
            )}

            {/* Email History */}
            <div className="text-xs text-gray-500 border-t pt-3">
              <span className="font-medium">Bereits gesendet:</span>
              <div className="flex flex-wrap gap-1 mt-2">
                {order.email_flags.confirmation_sent && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">✓ Bestätigung</span>}
                {order.email_flags.payment_instructions_sent && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">✓ Zahlung</span>}
                {order.email_flags.weekend_hello_sent && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">✓ Wochenend</span>}
                {order.email_flags.shipped_sent && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">✓ Versand</span>}
                {!order.email_flags.confirmation_sent && !order.email_flags.payment_instructions_sent &&
                 !order.email_flags.weekend_hello_sent && !order.email_flags.shipped_sent && (
                  <span className="text-gray-400">Noch keine</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="border rounded-lg overflow-hidden bg-gray-100">
            <div className="bg-gray-200 px-3 py-2 text-xs text-gray-600 border-b">
              Vorschau
            </div>

            {/* Email Preview - Branded Template */}
            <div className="bg-white m-2 rounded shadow-sm text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
              {/* Email Header */}
              <div style={{ background: '#2D5016', padding: '20px', textAlign: 'center' }}>
                <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>🌲 Pelletor</div>
              </div>

              {/* Email Meta */}
              <div style={{ background: '#f3f4f6', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontSize: '12px' }}>
                <div><span style={{ color: '#6b7280' }}>An:</span> {order.email}</div>
                <div style={{ fontWeight: '600' }}><span style={{ color: '#6b7280' }}>Betreff:</span> {subject}</div>
              </div>

              {/* Email Body */}
              <div style={{ padding: '20px' }}>
                <p style={{ marginBottom: '16px' }}>{salutation},</p>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{body}</div>
                <div style={{ marginTop: '24px' }}>
                  <p>Mit freundlichen Grüßen,</p>
                  <p style={{ fontWeight: '600', color: '#2D5016' }}>Ihr Pelletor Team</p>
                </div>
              </div>

              {/* Email Footer */}
              <div style={{ background: '#f9fafb', padding: '16px', borderTop: '1px solid #e5e7eb', fontSize: '11px', color: '#6b7280', textAlign: 'center' }}>
                <p style={{ fontWeight: '600', marginBottom: '4px' }}>Or Projekt GmbH</p>
                <p>Fördepromenade 2 | 24944 Flensburg | Deutschland</p>
                <p>Tel: +49 461 904 12 83 | info@pelletor.de</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || (selectedTemplate === 'custom' && (!customSubject || !customBody))}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSending ? 'Wird gesendet...' : '📤 E-Mail senden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
