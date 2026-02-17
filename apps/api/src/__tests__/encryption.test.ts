import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../utils/encryption.js';

describe('Encryption', () => {
  it('should encrypt and decrypt a string', () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32-byte hex key
    const plaintext = 'my-secret-token-12345';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same input', () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    const encrypted1 = encrypt('test');
    const encrypted2 = encrypt('test');
    expect(encrypted1).not.toBe(encrypted2); // Different IVs
  });
});
