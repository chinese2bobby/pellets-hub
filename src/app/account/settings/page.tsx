'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Mail, Phone, MapPin, Lock, Eye, EyeOff, Check, AlertCircle,
  Pencil, Plus, Trash2, Home, Building2, X, Save, Shield, Bell, ChevronRight
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthUser } from '@/lib/auth';
import { ProgressiveBackground } from '@/components/ui/progressive-background';

const BG_FULL = "https://srtsuzvjjcrliuaftvce.supabase.co/storage/v1/object/public/assets/bg-warehouse.png";
const BG_BLUR = "https://srtsuzvjjcrliuaftvce.supabase.co/storage/v1/object/public/assets/bg-warehouse-blur.png";

interface Address {
  id: string;
  label: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  isDefault: boolean;
}

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  addresses: Address[];
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile editing
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    phone: '',
    addresses: []
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Address editing
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState<Omit<Address, 'id'>>({
    label: 'Zuhause',
    name: '',
    street: '',
    zip: '',
    city: '',
    isDefault: false
  });

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/session');
      const result = await response.json();

      if (result.success) {
        setUser(result.data.user);
        await loadProfile(result.data.user.email);
      } else {
        router.push('/account/login');
      }
    } catch (error) {
      router.push('/account/login');
    }
    setLoading(false);
  }

  async function loadProfile(email: string) {
    try {
      const response = await fetch('/api/auth/profile');
      const result = await response.json();

      if (result.success) {
        setProfile({
          name: result.data.name || '',
          email: result.data.email || email,
          phone: result.data.phone || '',
          addresses: result.data.addresses || []
        });
      }
    } catch (error) {
      console.error('Profil konnte nicht geladen werden:', error);
    }
  }

  async function handleProfileSave() {
    setProfileError('');
    setProfileSuccess(false);
    setProfileLoading(true);

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone
        }),
      });

      const result = await response.json();

      if (result.success) {
        setProfileSuccess(true);
        setEditingProfile(false);
        if (user) {
          setUser({ ...user, name: profile.name });
        }
        setTimeout(() => setProfileSuccess(false), 3000);
      } else {
        setProfileError(result.error || 'Fehler beim Speichern');
      }
    } catch (err) {
      setProfileError('Verbindungsfehler. Bitte versuchen Sie es erneut.');
    }

    setProfileLoading(false);
  }

  async function handleAddressSave() {
    try {
      const response = await fetch('/api/auth/addresses', {
        method: editingAddress ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAddress ? { ...addressForm, id: editingAddress.id } : addressForm),
      });

      const result = await response.json();

      if (result.success) {
        await loadProfile(user?.email || '');
        setShowAddressModal(false);
        setEditingAddress(null);
        resetAddressForm();
      }
    } catch (err) {
      console.error('Adresse konnte nicht gespeichert werden:', err);
    }
  }

  async function handleAddressDelete(id: string) {
    if (!confirm('Möchten Sie diese Adresse wirklich löschen?')) return;

    try {
      const response = await fetch(`/api/auth/addresses?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadProfile(user?.email || '');
      }
    } catch (err) {
      console.error('Adresse konnte nicht gelöscht werden:', err);
    }
  }

  function resetAddressForm() {
    setAddressForm({
      label: 'Zuhause',
      name: '',
      street: '',
      zip: '',
      city: '',
      isDefault: false
    });
  }

  function openAddressModal(address?: Address) {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label,
        name: address.name,
        street: address.street,
        zip: address.zip,
        city: address.city,
        isDefault: address.isDefault
      });
    } else {
      setEditingAddress(null);
      resetAddressForm();
    }
    setShowAddressModal(true);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('Die Passwörter stimmen nicht überein');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Das neue Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const result = await response.json();

      if (result.success) {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordSection(false);
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError(result.error || 'Fehler beim Ändern des Passworts');
      }
    } catch (err) {
      setPasswordError('Verbindungsfehler. Bitte versuchen Sie es erneut.');
    }

    setPasswordLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-white to-[#f0f0e8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-[#2D5016] border-t-transparent animate-spin" />
          <span className="text-gray-500">Laden...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const displayName = profile.name || user.name;

  return (
    <div className="min-h-screen relative">
      <ProgressiveBackground 
        src={BG_FULL} 
        blurSrc={BG_BLUR} 
        overlayClassName="bg-[#FAFAF8]/90" 
      />
      <Header variant="customer" userName={displayName} />

      <main className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
        {/* Erfolgs-Banner */}
        {profileSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 flex items-center gap-3 animate-in slide-in-from-top duration-300">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span className="font-medium">Profil erfolgreich aktualisiert!</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 flex items-center gap-3 animate-in slide-in-from-top duration-300">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span className="font-medium">Passwort erfolgreich geändert!</span>
          </div>
        )}

        {/* Profil-Karte */}
        <Card className="mb-6 border-0 shadow-xl overflow-hidden">
          {/* Grüner Header mit Muster */}
          <div className="h-32 bg-gradient-to-r from-[#2D5016] via-[#3a6619] to-[#2D5016] relative">
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white/10"
                  style={{
                    width: `${4 + (i % 4) * 3}px`,
                    height: `${4 + (i % 4) * 3}px`,
                    left: `${5 + i * 5}%`,
                    top: `${15 + (i % 3) * 30}%`,
                    animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <CardContent className="pt-0 pb-6 px-6">
            {/* Avatar */}
            <div className="flex justify-center -mt-14 relative z-10 mb-4">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-xl flex items-center justify-center border-4 border-white">
                <span className="text-4xl font-bold text-[#2D5016]">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Name und Info */}
            <div className="text-center mb-6">
              {editingProfile ? (
                <div className="max-w-sm mx-auto space-y-3">
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Ihr vollständiger Name"
                    className="text-xl font-bold h-12 text-center"
                    autoFocus
                  />
                  <div className="flex justify-center gap-2">
                    <Button
                      onClick={handleProfileSave}
                      disabled={profileLoading}
                      size="sm"
                      className="bg-[#2D5016] hover:bg-[#1a3009]"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {profileLoading ? 'Speichern...' : 'Speichern'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingProfile(false);
                        setProfileError('');
                      }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                  <p className="text-gray-500 mt-1">Kunde seit 2025</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProfile(true)}
                    className="mt-3 border-[#2D5016]/20 text-[#2D5016] hover:bg-[#2D5016]/5"
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Profil bearbeiten
                  </Button>
                </>
              )}
            </div>

            {profileError && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {profileError}
              </div>
            )}

            {/* Kontaktdaten */}
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              <div
                className="group p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#2D5016]/20 hover:bg-[#2D5016]/5 transition-all cursor-pointer"
                onClick={() => !editingProfile && setEditingProfile(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center group-hover:shadow-md transition-shadow">
                    <Mail className="w-5 h-5 text-[#2D5016]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">E-Mail</p>
                    <p className="font-medium text-gray-900 truncate">{profile.email || user.email}</p>
                  </div>
                </div>
              </div>

              <div
                className="group p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-[#2D5016]/20 hover:bg-[#2D5016]/5 transition-all cursor-pointer"
                onClick={() => !editingProfile && setEditingProfile(true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center group-hover:shadow-md transition-shadow">
                    <Phone className="w-5 h-5 text-[#2D5016]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Telefon</p>
                    {editingProfile ? (
                      <Input
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        placeholder="+49 123 456789"
                        className="mt-1 h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="font-medium text-gray-900">
                        {profile.phone || <span className="text-gray-400">Nicht angegeben</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Einstellungen-Liste */}
        <div className="space-y-3">
          {/* Lieferadressen */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <button
              onClick={() => openAddressModal()}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Lieferadressen</h3>
                  <p className="text-sm text-gray-500">
                    {profile.addresses.length === 0
                      ? 'Keine Adressen gespeichert'
                      : `${profile.addresses.length} ${profile.addresses.length === 1 ? 'Adresse' : 'Adressen'} gespeichert`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#2D5016] font-medium">Verwalten</span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>

            {/* Adressen-Liste */}
            {profile.addresses.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-3 space-y-2">
                {profile.addresses.map((address) => (
                  <div
                    key={address.id}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      address.isDefault ? 'bg-[#2D5016]/5 border border-[#2D5016]/20' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        address.label === 'Zuhause' ? 'bg-blue-100' : 'bg-amber-100'
                      }`}>
                        {address.label === 'Zuhause' ? (
                          <Home className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Building2 className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">{address.label}</span>
                          {address.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2D5016] text-white font-medium">
                              Standard
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{address.street}, {address.zip} {address.city}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); openAddressModal(address); }}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-[#2D5016]"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleAddressDelete(address.id); }}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAddressModal()}
                  className="w-full mt-2 border-dashed"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Neue Adresse hinzufügen
                </Button>
              </div>
            )}
          </Card>

          {/* Passwort ändern */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <button
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-amber-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Passwort ändern</h3>
                  <p className="text-sm text-gray-500">Sicherheit Ihres Kontos verwalten</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showPasswordSection ? 'rotate-90' : ''}`} />
            </button>

            {showPasswordSection && (
              <div className="border-t border-gray-100 p-5">
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {passwordError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {passwordError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Aktuelles Passwort</label>
                    <div className="relative">
                      <Input
                        type={showPasswords ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Ihr aktuelles Passwort"
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Neues Passwort</label>
                      <Input
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mind. 8 Zeichen"
                        minLength={8}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Bestätigen</label>
                      <Input
                        type={showPasswords ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Passwort wiederholen"
                        minLength={8}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#2D5016] hover:bg-[#1a3009]"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? 'Wird gespeichert...' : 'Passwort ändern'}
                  </Button>
                </form>
              </div>
            )}
          </Card>

          {/* Sicherheit */}
          <Card className="border-0 shadow-lg">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Kontosicherheit</h3>
                  <p className="text-sm text-gray-500">Ihr Konto ist geschützt</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-600 font-medium">Aktiv</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Hinweis */}
        <div className="mt-6 p-4 rounded-xl bg-[#2D5016]/5 border border-[#2D5016]/10">
          <p className="text-sm text-gray-600">
            <strong className="text-[#2D5016]">Hinweis:</strong> Verwenden Sie ein sicheres Passwort mit mindestens 8 Zeichen, das Groß- und Kleinbuchstaben sowie Zahlen enthält.
          </p>
        </div>
      </main>

      {/* Adress-Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingAddress ? 'Adresse bearbeiten' : 'Neue Adresse'}
              </h3>
              <button
                onClick={() => {
                  setShowAddressModal(false);
                  setEditingAddress(null);
                  resetAddressForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Bezeichnung</label>
                <div className="flex gap-2">
                  {['Zuhause', 'Arbeit', 'Andere'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAddressForm({ ...addressForm, label })}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        addressForm.label === label
                          ? 'bg-[#2D5016] text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Name / Firma</label>
                <Input
                  value={addressForm.name}
                  onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                  placeholder="Max Mustermann"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Straße und Hausnummer</label>
                <Input
                  value={addressForm.street}
                  onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                  placeholder="Musterstraße 123"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">PLZ</label>
                  <Input
                    value={addressForm.zip}
                    onChange={(e) => setAddressForm({ ...addressForm, zip: e.target.value })}
                    placeholder="12345"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium text-gray-700">Stadt</label>
                  <Input
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="Berlin"
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-[#2D5016] focus:ring-[#2D5016]"
                />
                <span className="text-sm text-gray-700">Als Standardadresse festlegen</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddressModal(false);
                  setEditingAddress(null);
                  resetAddressForm();
                }}
              >
                Abbrechen
              </Button>
              <Button
                className="flex-1 bg-[#2D5016] hover:bg-[#1a3009]"
                onClick={handleAddressSave}
              >
                Speichern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
