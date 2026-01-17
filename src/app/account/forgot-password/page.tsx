'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, KeyRound, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Step = 'email' | 'code' | 'password' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first code input when step changes to 'code'
  useEffect(() => {
    if (step === 'code') {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  // Step 1: Request reset code
  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage('Ein Code wurde an Ihre E-Mail gesendet.');
        setStep('code');
      } else {
        setError(result.error || 'Fehler beim Senden des Codes');
      }
    } catch (err) {
      setError('Verbindungsfehler. Bitte versuchen Sie es erneut.');
    }

    setLoading(false);
  }

  // Handle digit input
  function handleDigitChange(index: number, value: string) {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...codeDigits];
    newDigits[index] = digit;
    setCodeDigits(newDigits);
    setError('');

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  // Handle backspace
  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  // Handle paste
  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      setCodeDigits(pastedData.split(''));
      inputRefs.current[5]?.focus();
    }
  }

  // Step 2: Verify code
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    const code = codeDigits.join('');

    if (code.length !== 6) {
      setError('Bitte geben Sie den vollständigen 6-stelligen Code ein');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Just verify the code exists (we'll do full reset in next step)
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', email, code }),
      });

      const result = await response.json();

      if (result.success || result.valid) {
        setStep('password');
        setMessage('');
      } else {
        setError(result.error || 'Ungültiger Code');
      }
    } catch (err) {
      setError('Verbindungsfehler. Bitte versuchen Sie es erneut.');
    }

    setLoading(false);
  }

  // Step 3: Reset password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein');
      return;
    }

    if (newPassword.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email,
          code: codeDigits.join(''),
          newPassword
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStep('success');
      } else {
        setError(result.error || 'Fehler beim Zurücksetzen des Passworts');
      }
    } catch (err) {
      setError('Verbindungsfehler. Bitte versuchen Sie es erneut.');
    }

    setLoading(false);
  }

  const codeComplete = codeDigits.every(d => d !== '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-white to-[#f0f0e8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2D5016] mb-4">
            <span className="text-2xl font-bold text-white">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pelletor</h1>
          <p className="text-gray-600 mt-1">Passwort zurücksetzen</p>
        </div>

        <Card className="border border-gray-200 shadow-lg">
          {/* Step 1: Enter Email */}
          {step === 'email' && (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-center text-gray-900 flex items-center justify-center gap-2">
                  <Mail className="w-5 h-5 text-[#2D5016]" />
                  E-Mail eingeben
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRequestCode} className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <p className="text-sm text-gray-600 text-center">
                    Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Code zum Zurücksetzen Ihres Passworts.
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">E-Mail-Adresse</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ihre@email.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#2D5016] hover:bg-[#1a3009]"
                    disabled={loading}
                  >
                    {loading ? 'Wird gesendet...' : 'Code anfordern'}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    href="/account/login"
                    className="text-sm text-gray-600 hover:text-[#2D5016] inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Zurück zum Login
                  </Link>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Enter Code */}
          {step === 'code' && (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-center text-gray-900 flex items-center justify-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#2D5016]" />
                  Code eingeben
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifyCode} className="space-y-6">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  {message && (
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-center">
                      {message}
                    </div>
                  )}

                  <p className="text-sm text-gray-600 text-center">
                    Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein.
                  </p>

                  {/* 6 Digit Inputs */}
                  <div className="flex justify-center gap-2" onPaste={handlePaste}>
                    {codeDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-lg focus:border-[#2D5016] focus:ring-2 focus:ring-[#2D5016]/20 outline-none transition-all"
                      />
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    Code gültig für 15 Minuten
                  </p>

                  <Button
                    type="submit"
                    className="w-full bg-[#2D5016] hover:bg-[#1a3009]"
                    disabled={loading || !codeComplete}
                  >
                    {loading ? 'Wird geprüft...' : 'Code bestätigen'}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setCodeDigits(['', '', '', '', '', '']);
                      setError('');
                      setMessage('');
                    }}
                    className="text-sm text-gray-600 hover:text-[#2D5016]"
                  >
                    Code erneut anfordern
                  </button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: New Password */}
          {step === 'password' && (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-center text-gray-900 flex items-center justify-center gap-2">
                  <KeyRound className="w-5 h-5 text-[#2D5016]" />
                  Neues Passwort
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm text-center">
                    Code bestätigt! Geben Sie jetzt Ihr neues Passwort ein.
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Neues Passwort</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mindestens 8 Zeichen"
                        minLength={8}
                        className="pr-10"
                        required
                        autoFocus
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

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Passwort bestätigen</label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                      minLength={8}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#2D5016] hover:bg-[#1a3009]"
                    disabled={loading}
                  >
                    {loading ? 'Wird gespeichert...' : 'Passwort ändern'}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-center text-gray-900 flex items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-7 h-7 text-green-600" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Passwort geändert!
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Ihr Passwort wurde erfolgreich zurückgesetzt. Sie können sich jetzt anmelden.
                </p>

                <Button
                  onClick={() => router.push('/account/login')}
                  className="w-full bg-[#2D5016] hover:bg-[#1a3009]"
                >
                  Zum Login
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
