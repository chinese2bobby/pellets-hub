'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { COMPANY, COUNTRY_CONFIG } from '@/config';
import { Country } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    default_country: 'AT' as Country,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  function updateField(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate
    if (formData.password !== formData.passwordConfirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    if (formData.password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Registrierung fehlgeschlagen');
        return;
      }

      // Redirect to orders
      router.push('/account/orders');
    } catch (err) {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#FAFAF8]">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#2D5016] mb-4">
            <span className="text-2xl font-bold text-white">P</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">{COMPANY.name}</h1>
          <p className="text-gray-600 mt-1">Kundenkonto erstellen</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registrieren</CardTitle>
            <CardDescription>
              Erstellen Sie ein Konto, um Ihre Bestellungen zu verwalten.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Country selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Land
                </label>
                <div className="flex gap-4">
                  {(['AT', 'DE'] as Country[]).map(country => (
                    <label key={country} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="country"
                        value={country}
                        checked={formData.default_country === country}
                        onChange={() => updateField('default_country', country)}
                        className="w-4 h-4 text-[#2D5016]"
                      />
                      <span className="text-sm">{COUNTRY_CONFIG[country].name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Vorname *
                  </label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => updateField('first_name', e.target.value.replace(/[^a-zA-ZäöüÄÖÜßéèêëàâáíìîïóòôõúùûñçÿ\s-]/g, ''))}
                    pattern="^[a-zA-ZäöüÄÖÜßéèêëàâáíìîïóòôõúùûñçÿ\s-]{2,}$"
                    minLength={2}
                    placeholder="Max"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nachname *
                  </label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => updateField('last_name', e.target.value.replace(/[^a-zA-ZäöüÄÖÜßéèêëàâáíìîïóòôõúùûñçÿ\s-]/g, ''))}
                    pattern="^[a-zA-ZäöüÄÖÜßéèêëàâáíìîïóòôõúùûñçÿ\s-]{2,}$"
                    minLength={2}
                    placeholder="Mustermann"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail-Adresse *
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value.toLowerCase())}
                  placeholder="max.mustermann@email.de"
                  pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value.replace(/[^0-9+\s()-]/g, ''))}
                  placeholder="+49 123 456789"
                  pattern="^[+]?[0-9\s()-]{6,20}$"
                />
              </div>

              {/* Company (optional) */}
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Firma (optional)
                </label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort *
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Mindestens 8 Zeichen"
                    minLength={8}
                    className="pr-10"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort bestätigen *
                </label>
                <div className="relative">
                  <Input
                    id="passwordConfirm"
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={formData.passwordConfirm}
                    onChange={(e) => updateField('passwordConfirm', e.target.value)}
                    placeholder="Passwort wiederholen"
                    minLength={8}
                    className="pr-10"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Mit der Registrierung akzeptieren Sie unsere{' '}
                <Link href="/agb" className="text-[#2D5016] hover:underline">AGB</Link> und{' '}
                <Link href="/datenschutz" className="text-[#2D5016] hover:underline">Datenschutzerklärung</Link>.
              </p>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Wird registriert...' : 'Konto erstellen'}
              </Button>

              <p className="text-sm text-center text-gray-600">
                Bereits registriert?{' '}
                <Link href="/account/login" className="text-[#2D5016] hover:underline font-medium">
                  Jetzt anmelden
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        {/* Back to shop */}
        <p className="text-center mt-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Zurück zum Shop
          </Link>
        </p>
      </div>
    </div>
  );
}

