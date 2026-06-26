import crypto from 'crypto';
import { logger } from './logger';

// Derive a 32-byte key from ENCRYPTION_SECRET or use a fallback
const getEncryptionKey = (): Buffer => {
  const secret = process.env.ENCRYPTION_SECRET || 'jobhit_ultra_secure_fallback_secret_key';
  return crypto.createHash('sha256').update(secret).digest();
};

const IV_LENGTH = 16; // AES block size

export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Return iv and encrypted data joined by colon
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Failed to encrypt text data', error);
    throw new Error('Encryption failed');
  }
}

export function decrypt(cipherText: string): string {
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 2) {
      // If it doesn't match format, assume it is plain text (e.g. legacy data before encryption)
      return cipherText;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    let finalDecrypted = Buffer.concat([decrypted, decipher.final()]).toString('utf8');
    return finalDecrypted;
  } catch (error) {
    logger.error('Failed to decrypt text data', error);
    // Return the original ciphertext as fallback (useful for dev check or if decryption key changed)
    return cipherText;
  }
}
