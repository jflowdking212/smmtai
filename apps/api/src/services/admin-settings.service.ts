import { prisma } from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/errorHandler.js';

const SENSITIVE_KEYS = new Set([
  'smtp_pass',
  'storage_access_key',
  'storage_secret_key',
]);

export interface SmtpConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  smtp_secure: string;
}

export interface StorageConfig {
  storage_provider: string; // 'wasabi' | 'digitalocean'
  storage_endpoint: string;
  storage_region: string;
  storage_bucket: string;
  storage_access_key: string;
  storage_secret_key: string;
}

async function getConfig(key: string): Promise<string | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  if (!row) return null;
  return row.encrypted ? decrypt(row.value) : row.value;
}

async function setConfig(key: string, value: string): Promise<void> {
  const isSensitive = SENSITIVE_KEYS.has(key);
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value: isSensitive ? encrypt(value) : value, encrypted: isSensitive },
    create: { key, value: isSensitive ? encrypt(value) : value, encrypted: isSensitive },
  });
}

async function getConfigGroup(prefix: string): Promise<Record<string, string>> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { startsWith: prefix } },
  });
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.encrypted ? decrypt(row.value) : row.value;
  }
  return result;
}

function maskSecret(value: string | undefined): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

// ----- SMTP -----

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const cfg = await getConfigGroup('smtp_');
  return {
    smtp_host: cfg.smtp_host || '',
    smtp_port: cfg.smtp_port || '587',
    smtp_user: cfg.smtp_user || '',
    smtp_pass: cfg.smtp_pass || '',
    smtp_from: cfg.smtp_from || '',
    smtp_secure: cfg.smtp_secure || 'true',
  };
}

export async function getSmtpConfigMasked(): Promise<Record<string, string>> {
  const cfg = await getSmtpConfig();
  return {
    ...cfg,
    smtp_pass: maskSecret(cfg.smtp_pass),
  };
}

export async function saveSmtpConfig(data: Partial<SmtpConfig>): Promise<void> {
  const allowed = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure'] as const;
  for (const key of allowed) {
    if (data[key] !== undefined && data[key] !== '') {
      await setConfig(key, data[key]);
    }
  }
}

export async function testSmtpConnection(toEmail: string): Promise<{ success: boolean; message: string }> {
  const cfg = await getSmtpConfig();
  if (!cfg.smtp_host || !cfg.smtp_user) {
    throw new AppError('SMTP is not configured. Save credentials first.', 400, 'SMTP_NOT_CONFIGURED');
  }

  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port, 10),
      secure: cfg.smtp_secure === 'true',
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });

    await transport.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to: toEmail,
      subject: 'EE PostMind — SMTP Test',
      text: 'This is a test email confirming your SMTP configuration works.',
      html: '<p>This is a test email confirming your <strong>SMTP configuration</strong> works.</p>',
    });

    return { success: true, message: 'Test email sent successfully.' };
  } catch (err: any) {
    throw new AppError(`SMTP test failed: ${err.message}`, 400, 'SMTP_TEST_FAILED');
  }
}

// ----- Cloud Storage -----

export async function getStorageConfig(): Promise<StorageConfig> {
  const cfg = await getConfigGroup('storage_');
  return {
    storage_provider: cfg.storage_provider || '',
    storage_endpoint: cfg.storage_endpoint || '',
    storage_region: cfg.storage_region || '',
    storage_bucket: cfg.storage_bucket || '',
    storage_access_key: cfg.storage_access_key || '',
    storage_secret_key: cfg.storage_secret_key || '',
  };
}

export async function getStorageConfigMasked(): Promise<Record<string, string>> {
  const cfg = await getStorageConfig();
  return {
    ...cfg,
    storage_access_key: maskSecret(cfg.storage_access_key),
    storage_secret_key: maskSecret(cfg.storage_secret_key),
  };
}

export async function saveStorageConfig(data: Partial<StorageConfig>): Promise<void> {
  const allowed = ['storage_provider', 'storage_endpoint', 'storage_region', 'storage_bucket', 'storage_access_key', 'storage_secret_key'] as const;
  for (const key of allowed) {
    if (data[key] !== undefined && data[key] !== '') {
      await setConfig(key, data[key]);
    }
  }
}

export async function testStorageConnection(): Promise<{ success: boolean; message: string }> {
  const cfg = await getStorageConfig();
  if (!cfg.storage_endpoint || !cfg.storage_access_key) {
    throw new AppError('Storage is not configured. Save credentials first.', 400, 'STORAGE_NOT_CONFIGURED');
  }

  try {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint: cfg.storage_endpoint,
      region: cfg.storage_region || 'us-east-1',
      credentials: {
        accessKeyId: cfg.storage_access_key,
        secretAccessKey: cfg.storage_secret_key,
      },
      forcePathStyle: true,
    });

    await client.send(new ListObjectsV2Command({
      Bucket: cfg.storage_bucket,
      MaxKeys: 1,
    }));

    return { success: true, message: `Connected to bucket "${cfg.storage_bucket}" successfully.` };
  } catch (err: any) {
    throw new AppError(`Storage test failed: ${err.message}`, 400, 'STORAGE_TEST_FAILED');
  }
}
