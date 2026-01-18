import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isWeekend, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import QRCode from 'qrcode';
import { Country, TotalsSnapshot } from '@/types';
import { COUNTRY_CONFIG, EMAIL_CONFIG } from '@/config';

// ============================================
// CLASSNAME UTILITY
// ============================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// ORDER NUMBER FORMATTING
// ============================================

/**
 * Format order sequence to display format
 * 300001 -> "300-001"
 */
export function formatOrderNo(seq: number): string {
  const str = seq.toString().padStart(6, '0');
  return `${str.slice(0, 3)}-${str.slice(3)}`;
}

/**
 * Parse display order number back to sequence
 * "300-001" -> 300001
 */
export function parseOrderNo(orderNo: string): number {
  return parseInt(orderNo.replace('-', ''), 10);
}

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Format cents to currency string
 */
export function formatCurrency(cents: number, country: Country = 'DE'): string {
  const config = COUNTRY_CONFIG[country];
  const euros = cents / 100;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
  }).format(euros);
}

/**
 * Format cents to simple decimal (for inputs)
 */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Parse decimal string to cents
 */
export function decimalToCents(decimal: string): number {
  return Math.round(parseFloat(decimal) * 100);
}

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format date for display
 */
export function formatDate(date: string | Date, formatStr: string = 'dd.MM.yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: de });
}

/**
 * Format datetime for display
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd.MM.yyyy HH:mm');
}

/**
 * Relative time (e.g., "vor 2 Stunden")
 */
export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: de });
}

/**
 * Check if date is on weekend (Saturday or Sunday)
 */
export function isWeekendOrder(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isWeekend(d);
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(date: string | Date): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d.getDay();
}

/**
 * Check if order needs weekend hello email
 */
export function needsWeekendHello(createdAt: string): boolean {
  const day = getDayOfWeek(createdAt);
  return EMAIL_CONFIG.weekend_days.includes(day);
}

// ============================================
// VAT CALCULATIONS
// ============================================

/**
 * Calculate VAT from net amount
 */
export function calculateVat(netCents: number, vatRate: number): number {
  return Math.round(netCents * vatRate);
}

/**
 * Calculate gross from net amount
 */
export function calculateGross(netCents: number, vatRate: number): number {
  return netCents + calculateVat(netCents, vatRate);
}

/**
 * Calculate net from gross amount
 */
export function calculateNet(grossCents: number, vatRate: number): number {
  return Math.round(grossCents / (1 + vatRate));
}

/**
 * Build totals snapshot for order
 */
export function buildTotalsSnapshot(
  subtotalNet: number,
  shippingNet: number,
  surchargesNet: number,
  country: Country
): TotalsSnapshot {
  const config = COUNTRY_CONFIG[country];
  const totalNet = subtotalNet + shippingNet + surchargesNet;
  const vatAmount = calculateVat(totalNet, config.vat_rate);
  
  return {
    subtotal_net: subtotalNet,
    shipping_net: shippingNet,
    surcharges_net: surchargesNet,
    vat_rate: config.vat_rate,
    vat_label: config.vat_label,
    vat_amount: vatAmount,
    total_gross: totalNet + vatAmount,
  };
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Generate slug from string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ============================================
// RANDOM UTILITIES
// ============================================

/**
 * Generate random delay within range (for status automation)
 * Uses order ID as seed for deterministic results
 */
export function getRandomDelay(orderId: string, min: number, max: number): number {
  // Simple hash from order ID for deterministic randomness
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    const char = orderId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const range = max - min;
  const random = Math.abs(hash % 1000) / 1000;
  return Math.round(min + (random * range));
}

/**
 * Generate UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate phone number (basic)
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?[0-9]{8,15}$/.test(cleaned);
}

/**
 * Validate postal code by country
 */
export function isValidPostalCode(zip: string, country: Country): boolean {
  if (country === 'DE') {
    return /^[0-9]{5}$/.test(zip);
  }
  if (country === 'AT') {
    return /^[0-9]{4}$/.test(zip);
  }
  return false;
}

// ============================================
// ADDRESS FORMATTING
// ============================================

/**
 * Format address for display
 */
export function formatAddress(address: {
  street: string;
  house_no: string;
  zip: string;
  city: string;
  country: Country;
  stiege?: string;
  tuer?: string;
  top?: string;
}): string {
  const parts = [`${address.street} ${address.house_no}`];
  
  // Austrian specifics
  if (address.stiege) parts[0] += `, Stiege ${address.stiege}`;
  if (address.tuer) parts[0] += `, Tür ${address.tuer}`;
  if (address.top) parts[0] += `, Top ${address.top}`;
  
  parts.push(`${address.zip} ${address.city}`);
  parts.push(COUNTRY_CONFIG[address.country].name);
  
  return parts.join('\n');
}

/**
 * Format address as single line
 */
export function formatAddressOneLine(address: {
  street: string;
  house_no: string;
  zip: string;
  city: string;
}): string {
  return `${address.street} ${address.house_no}, ${address.zip} ${address.city}`;
}

// ============================================
// EPC QR CODE GENERATION
// ============================================

interface BankingDetails {
  iban: string;
  bic: string;
  payment_recipient: string;
}

export async function generateEpcQrCode(
  amountCents: number,
  reference: string,
  bank: BankingDetails
): Promise<string> {
  const epcData = [
    'BCD',
    '002',
    '1',
    'SCT',
    bank.bic.replace(/\s/g, ''),
    bank.payment_recipient.substring(0, 70),
    bank.iban.replace(/\s/g, ''),
    `EUR${(amountCents / 100).toFixed(2)}`,
    '',
    reference.substring(0, 140),
    ''
  ].join('\n');

  try {
    const dataUri = await QRCode.toDataURL(epcData, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 200,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    return dataUri;
  } catch (error) {
    console.error('Failed to generate EPC QR code:', error);
    return '';
  }
}

export function getEpcQrCodeUrl(
  amountCents: number,
  reference: string,
  bank: BankingDetails
): string {
  const epcData = [
    'BCD',
    '002',
    '1',
    'SCT',
    bank.bic.replace(/\s/g, ''),
    bank.payment_recipient.substring(0, 70),
    bank.iban.replace(/\s/g, ''),
    `EUR${(amountCents / 100).toFixed(2)}`,
    '',
    reference.substring(0, 140),
    ''
  ].join('\n');

  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(epcData)}`;
}

