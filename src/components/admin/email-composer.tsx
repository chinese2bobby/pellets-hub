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
  { value: 'confirmation', label: 'Bestellbestätigung', description: 'Bestätigt die Bestellung mit allen Details' },
  { value: 'payment_instructions', label: 'Zahlungsanweisung', description: 'Bankdaten und Zahlungsinformationen' },
  { value: 'weekend_hello', label: 'Wochenend-Begrüßung', description: 'Kurze Bestätigung für Wochenendbestellungen' },
  { value: 'invoice', label: 'Rechnung', description: 'Rechnung mit allen Positionen und Steuern' },
  { value: 'shipped', label: 'Versandbestätigung', description: 'Bestellung wurde versandt' },
  { value: 'delivered', label: 'Zustellbestätigung', description: 'Bestellung wurde zugestellt' },
  { value: 'cancelled', label: 'Stornierung', description: 'Bestellung wurde storniert' },
  { value: 'custom', label: 'Benutzerdefiniert', description: 'Eigene Nachricht verfassen' },
];

// Get proper salutation based on customer data
function getSalutation(salutation: Salutation | undefined, customerName: string, country: 'DE' | 'AT'): string {
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

export function EmailComposer({ order, isOpen, onClose, onSend }: EmailComposerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailType>('confirmation');
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [attachInvoice, setAttachInvoice] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Generate preview content
  const salutation = getSalutation(order.salutation, order.customer_name, order.country);
  const vatLabel = order.country === 'AT' ? 'USt.' : 'MwSt.';
  const vatRate = order.country === 'AT' ? '20%' : '7%';

  // Get default subject based on template
  const getDefaultSubject = (template: EmailType): string => {
    switch (template) {
      case 'confirmation':
        return `Bestellbestätigung ${order.order_no} - Pelletor`;
      case 'payment_instructions':
        return `Zahlungsinformationen für Bestellung ${order.order_no}`;
      case 'weekend_hello':
        return `Ihre Bestellung ${order.order_no} ist eingegangen`;
      case 'invoice':
        return `Rechnung zu Bestellung ${order.order_no}`;
      case 'shipped':
        return `Ihre Bestellung ${order.order_no} wurde versandt`;
      case 'delivered':
        return `Ihre Bestellung ${order.order_no} wurde zugestellt`;
      case 'cancelled':
        return `Bestellung ${order.order_no} wurde storniert`;
      case 'custom':
        return customSubject;
      default:
        return `Bestellung ${order.order_no}`;
    }
  };

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>📧</span>
            <span>E-Mail senden</span>
            <span className="text-sm font-normal text-gray-500">({order.order_no})</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Order Info Summary */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">Kunde:</span> {order.customer_name}</div>
              <div><span className="text-gray-500">E-Mail:</span> {order.email}</div>
              <div><span className="text-gray-500">Land:</span> {order.country === 'AT' ? 'Österreich' : 'Deutschland'}</div>
              <div><span className="text-gray-500">Betrag:</span> {formatCurrency(order.totals.total_gross, order.country)}</div>
            </div>
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Vorlage wählen</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value as EmailType)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {EMAIL_TEMPLATES.map((template) => (
                <option key={template.value} value={template.value}>
                  {template.label} - {template.description}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Email Fields */}
          {selectedTemplate === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Betreff</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="E-Mail Betreff..."
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Nachricht</label>
                <textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="Ihre Nachricht..."
                  rows={6}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variablen: {'{kunde}'}, {'{bestellnummer}'}, {'{betrag}'}, {'{anrede}'}
                </p>
              </div>
            </>
          )}

          {/* Invoice Attachment Option */}
          {(selectedTemplate === 'confirmation' || selectedTemplate === 'invoice' || selectedTemplate === 'custom') && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={attachInvoice}
                onChange={(e) => setAttachInvoice(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm">Rechnung als PDF anhängen</span>
            </label>
          )}

          {/* Preview */}
          <div>
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              {previewMode ? '▼ Vorschau ausblenden' : '▶ Vorschau anzeigen'}
            </button>

            {previewMode && (
              <div className="mt-3 border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b">
                  <div className="text-sm">
                    <span className="text-gray-500">An:</span> {order.email}
                  </div>
                  <div className="text-sm font-medium">
                    <span className="text-gray-500">Betreff:</span> {getDefaultSubject(selectedTemplate)}
                  </div>
                </div>
                <div className="p-4 bg-white text-sm">
                  <p className="mb-3">{salutation},</p>
                  {selectedTemplate === 'custom' ? (
                    <p className="whitespace-pre-wrap">{customBody || '(Keine Nachricht eingegeben)'}</p>
                  ) : (
                    <>
                      {selectedTemplate === 'confirmation' && (
                        <p>vielen Dank für Ihre Bestellung bei Pelletor! Ihre Bestellung {order.order_no} wurde bestätigt.</p>
                      )}
                      {selectedTemplate === 'payment_instructions' && (
                        <p>hier sind Ihre Zahlungsinformationen für Bestellung {order.order_no}. Bitte überweisen Sie {formatCurrency(order.totals.total_gross, order.country)} innerhalb von 7 Tagen.</p>
                      )}
                      {selectedTemplate === 'invoice' && (
                        <p>anbei finden Sie die Rechnung zu Ihrer Bestellung {order.order_no}. Gesamtbetrag: {formatCurrency(order.totals.total_gross, order.country)} (inkl. {vatRate} {vatLabel})</p>
                      )}
                      {selectedTemplate === 'shipped' && (
                        <p>gute Nachrichten! Ihre Bestellung {order.order_no} wurde versandt und ist auf dem Weg zu Ihnen.</p>
                      )}
                      {selectedTemplate === 'cancelled' && (
                        <p>Ihre Bestellung {order.order_no} wurde storniert. Falls Sie bereits bezahlt haben, wird der Betrag zurückerstattet.</p>
                      )}
                    </>
                  )}
                  <p className="mt-3">Mit freundlichen Grüßen,<br/>Ihr Pelletor Team</p>
                </div>
              </div>
            )}
          </div>

          {/* Email History */}
          <div className="text-xs text-gray-500 border-t pt-3">
            <span className="font-medium">Bereits gesendet:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {order.email_flags.confirmation_sent && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ Bestätigung</span>}
              {order.email_flags.payment_instructions_sent && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ Zahlung</span>}
              {order.email_flags.weekend_hello_sent && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ Wochenend</span>}
              {order.email_flags.shipped_sent && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">✓ Versand</span>}
              {!order.email_flags.confirmation_sent && !order.email_flags.payment_instructions_sent &&
               !order.email_flags.weekend_hello_sent && !order.email_flags.shipped_sent && (
                <span className="text-gray-400">Noch keine E-Mails gesendet</span>
              )}
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
            className="bg-green-600 hover:bg-green-700"
          >
            {isSending ? 'Wird gesendet...' : '📤 E-Mail senden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
