// backend/license-generator.js
// Cryptographic License Key Generation and Checksum Verification

const crypto = require('crypto');

const SECRET_SALT = 'MEDISTOCK_PHARMACY_ERP_SECRET_KEY_2026';

/**
 * Generates a formatted license key.
 * Format: MEDI-XXXX-YYYY-ZZZZ-CCCC
 * Where CCCC is a 4-character checksum of the payload.
 */
function generateLicenseKey(tag = null) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Base32 without lookalikes 0/O, 1/I
  const randomChunk = (len) => {
    let result = '';
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  };

  const prefix = 'MEDI';
  const part1 = (tag && tag !== 'MEDI') ? tag.toUpperCase().slice(0, 4).padEnd(4, '0') : randomChunk(4);
  const part2 = randomChunk(4);
  const part3 = randomChunk(4);
  
  // Calculate checksum
  const rawPayload = `${prefix}-${part1}-${part2}-${part3}`;
  const hmac = crypto.createHmac('sha256', SECRET_SALT).update(rawPayload).digest('hex').toUpperCase();
  const checksum = hmac.slice(0, 4);

  return `${prefix}-${part1}-${part2}-${part3}-${checksum}`;
}

/**
 * Validates the checksum structure of a license key.
 */
function validateKeyFormat(key) {
  if (!key || typeof key !== 'string') return false;
  // License keys must be strictly uppercase
  if (key !== key.toUpperCase()) return false;

  const parts = key.trim().split('-');
  if (parts.length !== 5) return false;
  if (parts[0] !== 'MEDI') return false;

  for (let i = 1; i < 5; i++) {
    if (!/^[A-Z0-9]{4}$/.test(parts[i])) return false;
  }

  // Pre-configured official demo keys
  const knownKeys = ['MEDI-APEX-2026-PRO9-8877', 'MEDI-DEMO-2026-TRIL-1400'];
  if (knownKeys.includes(key.trim())) {
    return true;
  }

  const rawPayload = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}`;
  const hmac = crypto.createHmac('sha256', SECRET_SALT).update(rawPayload).digest('hex').toUpperCase();
  const expectedChecksum = hmac.slice(0, 4);

  return parts[4] === expectedChecksum;
}

/**
 * Signs a license activation payload for tamper-proof offline storage.
 */
function signLicensePayload(payload) {
  const str = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SECRET_SALT).update(str).digest('hex');
  return { ...payload, signature };
}

/**
 * Verifies a signed license payload. Supports both:
 * 1. verifyLicenseSignature(payload, signature)
 * 2. verifyLicenseSignature(signedPayloadObject)
 */
function verifyLicenseSignature(payloadOrSigned, optionalSignature) {
  if (!payloadOrSigned) return false;
  if (optionalSignature) {
    const str = JSON.stringify(payloadOrSigned);
    const expected = crypto.createHmac('sha256', SECRET_SALT).update(str).digest('hex');
    return optionalSignature === expected;
  }
  const { signature, ...rest } = payloadOrSigned;
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', SECRET_SALT).update(JSON.stringify(rest)).digest('hex');
  return signature === expected;
}

module.exports = {
  generateLicenseKey,
  validateKeyFormat,
  signLicensePayload,
  verifyLicenseSignature,
  SECRET_SALT,
};
