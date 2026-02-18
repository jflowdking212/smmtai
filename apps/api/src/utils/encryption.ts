import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCRYPTION_KEY_PATTERN = /^[0-9a-f]{64}$/i;

function resolveEncryptionKeyHex(): string {
  const configuredKey = process.env.ENCRYPTION_KEY?.trim();
  if (configuredKey) {
    if (!ENCRYPTION_KEY_PATTERN.test(configuredKey)) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string');
    }
    return configuredKey;
  }

  const seed = process.env.JWT_SECRET?.trim() || 'ee-postmind-dev-encryption-key';
  return crypto.createHash('sha256').update(seed).digest('hex');
}

const key = Buffer.from(resolveEncryptionKeyHex(), 'hex');

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  // Format: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encrypted] = data.split(':');
  if (!ivHex || !tagHex || !encrypted) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Invalid encrypted payload');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
