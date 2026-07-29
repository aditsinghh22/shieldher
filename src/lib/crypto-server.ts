import crypto from 'node:crypto';

/**
 * Decrypts a buffer that was encrypted via Web Crypto (AES-256-GCM).
 * Web Crypto appends the 16-byte auth tag to the ciphertext.
 */
export function decryptBuffer(buffer: Buffer, keyBase64: string, ivBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');
  
  const tagLength = 16;
  if (buffer.length < tagLength) {
    throw new Error('Ciphertext too short (missing auth tag)');
  }

  const authTag = buffer.subarray(buffer.length - tagLength);
  const encryptedContent = buffer.subarray(0, buffer.length - tagLength);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedContent), decipher.final()]);
}

/**
 * Encrypts data using AES-256-GCM for storage.
 * Returns { iv, ciphertext } where ciphertext includes the tag.
 * Compatible with browser-side Web Crypto (subtle.decrypt).
 */
export function encryptData(data: any, keyBase64: string, providedIv?: Buffer): { iv: string; ciphertext: string } {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  const key = Buffer.from(keyBase64, 'base64');
  const iv = providedIv || crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('base64'),
    ciphertext: Buffer.concat([encrypted, tag]).toString('base64')
  };
}

/**
 * Decrypts text/JSON that was encrypted via encryptData or Web Crypto.
 * Supports legacy JSON objects starts with '{' (which contain their own IV).
 */
export function decryptText(ciphertextBase64: string, keyBase64: string, ivBase64?: string): string {
  if (!ciphertextBase64) return '';
  
  // Legacy Check: if it starts with '{', it might be a JSON payload {iv, ciphertext}
  if (ciphertextBase64.trim().startsWith('{')) {
    try {
      const payload = JSON.parse(ciphertextBase64);
      if (payload.iv && payload.ciphertext) {
        return decryptText(payload.ciphertext, keyBase64, payload.iv);
      }
    } catch (e) {
      console.error('[CryptoServer] Failed to parse legacy JSON payload:', e);
    }
  }

  const buffer = Buffer.from(ciphertextBase64, 'base64');
  const decrypted = decryptBuffer(buffer, keyBase64, ivBase64 || '');
  return decrypted.toString('utf8');
}
