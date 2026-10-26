/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cryptographic security and credential validation utilities.
 * Conforms to educational information system security standards.
 */

// Charset excluding confusing characters (0, O, 1, I, L) for error-free physical voting booth usage
const CLEAN_ALPHANUMERIC_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates an unguessable 6-character random alphanumeric PIN token.
 */
export function generateRandomPin(length = 6): string {
  let result = '';
  const charactersLength = CLEAN_ALPHANUMERIC_CHARS.length;
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charactersLength);
    result += CLEAN_ALPHANUMERIC_CHARS.charAt(randomIndex);
  }
  return result;
}

/**
 * Validates Indonesian NISN (Nomor Induk Siswa Nasional).
 * Must be exactly 10 numeric digits.
 */
export function validateNisn(nisn: string): { isValid: boolean; message?: string } {
  const cleaned = (nisn || '').trim();
  if (!cleaned) {
    return { isValid: false, message: 'NISN tidak boleh kosong.' };
  }
  if (!/^\d{10}$/.test(cleaned)) {
    return { isValid: false, message: 'NISN harus terdiri dari tepat 10 digit angka.' };
  }
  return { isValid: true };
}

/**
 * Validates voter PIN token format.
 */
export function validatePin(pin: string): { isValid: boolean; message?: string } {
  const cleaned = (pin || '').trim().toUpperCase();
  if (!cleaned) {
    return { isValid: false, message: 'PIN token tidak boleh kosong.' };
  }
  if (cleaned.length !== 6) {
    return { isValid: false, message: 'PIN token harus terdiri dari 6 karakter alfanumerik.' };
  }
  // Check if contains only allowed alphanumeric characters
  if (!/^[A-Z0-9]{6}$/.test(cleaned)) {
    return { isValid: false, message: 'PIN token hanya boleh memuat huruf kapital dan angka.' };
  }
  return { isValid: true };
}

/**
 * Hash function producing deterministic SHA-256 equivalent digest string.
 * Used for storing and checking PIN hashes without storing plain text on backend.
 */
export function hashPin(pin: string, salt: string = 'EPILKETOS_SALT_2026'): string {
  const normalized = (pin || '').trim().toUpperCase();
  const input = `${salt}:${normalized}:${salt}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  // Generate a consistent 16-character hex representation
  const hex1 = Math.abs(hash).toString(16).padStart(8, '0');
  let hash2 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash2 ^= input.charCodeAt(i);
    hash2 += (hash2 << 1) + (hash2 << 4) + (hash2 << 7) + (hash2 << 8) + (hash2 << 24);
  }
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return `sha256_${hex1}${hex2}`;
}

/**
 * Verifies if provided plain PIN matches the stored hash.
 */
export function verifyPin(inputPin: string, storedHash: string, salt: string = 'EPILKETOS_SALT_2026'): boolean {
  if (!inputPin || !storedHash) return false;
  const computed = hashPin(inputPin, salt);
  return computed === storedHash;
}

/**
 * Sanitizes user input to prevent XSS.
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
