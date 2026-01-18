'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, 
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompanySettings } from '@/types';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      const result = await res.json();
      
      if (!result.success) {
        if (res.status === 401) {
          router.push('/admin/login');
          return;
        }
        throw new Error(result.error);
      }
      
      setSettings(result.data);
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Laden der Einstellungen' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      const result = await res.json();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setSettings(result.data);
      setMessage({ type: 'success', text: 'Einstellungen gespeichert' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof CompanySettings, value: string) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Einstellungen konnten nicht geladen werden</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="admin" userName="Admin" />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zahlungseinstellungen</h1>
            <p className="text-gray-500 mt-1">Bankverbindung für Kundenrechnungen</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Speichern
          </Button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Bankverbindung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zahlungsempfänger
              </label>
              <Input
                value={settings.payment_recipient}
                onChange={(e) => updateField('payment_recipient', e.target.value)}
                placeholder="Name des Kontoinhabers"
              />
              <p className="mt-1 text-xs text-gray-500">
                Wird als Kontoinhaber in allen Rechnungen und E-Mails angezeigt
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IBAN
              </label>
              <Input
                value={settings.iban}
                onChange={(e) => updateField('iban', e.target.value)}
                className="font-mono"
                placeholder="AT00 0000 0000 0000 0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                BIC
              </label>
              <Input
                value={settings.bic}
                onChange={(e) => updateField('bic', e.target.value)}
                className="font-mono"
                placeholder="ABCDEFGH"
              />
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Hinweis zum externen Lager</p>
                  <p>
                    In allen Kunden-E-Mails und Rechnungen wird automatisch ein Hinweis angezeigt, 
                    dass die Zahlung an <strong>{settings.payment_recipient}</strong> geht 
                    (externes Lager). Die Bestellung bleibt bei {settings.legal_name} registriert.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
