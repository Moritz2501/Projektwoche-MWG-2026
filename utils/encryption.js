import crypto from 'crypto';

/**
 * AES-256-GCM Encryption Utility
 * Provides secure encryption/decryption for JSON file storage
 */

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_BYTE_LEN = 16;
const SALT_BYTE_LEN = 64;
const IV_BYTE_LEN = 12;

/**
 * Encrypt data using AES-256-GCM
 * @param {Object} data - Data object to encrypt
 * @param {string} encryptionKey - 32-byte hex encryption key
 * @returns {string} Encrypted data as base64 string with IV and auth tag
 */
export function encryptData(data, encryptionKey) {
  try {
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    if (keyBuffer.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (256 bits)');
    }

    const iv = crypto.randomBytes(IV_BYTE_LEN);
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    
    const plaintext = JSON.stringify(data);
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine: IV + authTag + ciphertext
    const result = Buffer.concat([iv, authTag, encrypted]);
    return result.toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error.message);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Encrypted data as base64 string
 * @param {string} encryptionKey - 32-byte hex encryption key
 * @returns {Object} Decrypted data object
 */
export function decryptData(encryptedData, encryptionKey) {
  try {
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    if (keyBuffer.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (256 bits)');
    }

    const data = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const iv = data.subarray(0, IV_BYTE_LEN);
    const authTag = data.subarray(IV_BYTE_LEN, IV_BYTE_LEN + AUTH_TAG_BYTE_LEN);
    const ciphertext = data.subarray(IV_BYTE_LEN + AUTH_TAG_BYTE_LEN);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    console.error('Decryption failed:', error.message);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Generate a cryptographically secure encryption key
 * @returns {string} 32-byte hex encryption key
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a cryptographically secure IV
 * @returns {string} 16-byte hex IV
 */
export function generateIV() {
  return crypto.randomBytes(16).toString('hex');
}
