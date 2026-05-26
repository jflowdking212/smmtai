import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { prisma } from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/errorHandler.js';

const SENSITIVE_KEYS = new Set([
  'smtp_pass',
  'storage_access_key',
  'storage_secret_key',
  'platform_entreprenrs_access_token',
  'platform_entreprenrs_server_key',
  'platform_chrxstians_access_token',
  'platform_chrxstians_server_key',
  'platform_iohah_access_token',
  'platform_iohah_server_key',
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

function normalizeValue(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isMaskedSecret(value: string | undefined): boolean {
  if (!value) return false;
  return /^\*{4,}/.test(value.trim());
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = normalizeValue(value);
    if (normalized) return normalized;
  }
  return '';
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
      subject: 'SmmtAI — SMTP Test',
      text: 'This is a test email confirming your SMTP configuration works.',
      html: '<p>This is a test email confirming your <strong>SMTP configuration</strong> works.</p>',
    });

    return { success: true, message: 'Test email sent successfully.' };
  } catch (err: any) {
    throw new AppError(`SMTP test failed: ${err.message}`, 400, 'SMTP_TEST_FAILED');
  }
}

// ----- Site General Settings -----

export interface SiteSettings {
  site_title: string;
  site_tagline: string;
  site_favicon: string;
  site_logo: string;
  seo_meta_title: string;
  seo_meta_description: string;
  fb_pixel_id: string;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const cfg = await getConfigGroup('site_');
  const seo = await getConfigGroup('seo_');
  return {
    site_title: cfg.site_title || '',
    site_tagline: cfg.site_tagline || '',
    site_favicon: cfg.site_favicon || '',
    site_logo: cfg.site_logo || '',
    seo_meta_title: seo.seo_meta_title || '',
    seo_meta_description: seo.seo_meta_description || '',
    fb_pixel_id: cfg.fb_pixel_id || '',
  };
}

export async function saveSiteSettings(data: Partial<SiteSettings>): Promise<void> {
  const allowed = ['site_title', 'site_tagline', 'site_favicon', 'site_logo', 'seo_meta_title', 'seo_meta_description', 'fb_pixel_id'] as const;
  for (const key of allowed) {
    if (data[key] !== undefined) {
      await setConfig(key, data[key]);
    }
  }
}

export async function getStorageConfig(): Promise<StorageConfig> {
  const cfg = await getConfigGroup('storage_');
  const configuredAccessKey = normalizeValue(cfg.storage_access_key);
  const configuredSecretKey = normalizeValue(cfg.storage_secret_key);
  const accessKey = isMaskedSecret(configuredAccessKey) ? '' : configuredAccessKey;
  const secretKey = isMaskedSecret(configuredSecretKey) ? '' : configuredSecretKey;

  return {
    storage_provider: firstNonEmpty(
      cfg.storage_provider,
      process.env.STORAGE_PROVIDER,
      process.env.DO_SPACES_ENDPOINT ? 'digitalocean' : undefined,
    ),
    storage_endpoint: firstNonEmpty(cfg.storage_endpoint, process.env.STORAGE_ENDPOINT, process.env.DO_SPACES_ENDPOINT),
    storage_region: firstNonEmpty(cfg.storage_region, process.env.STORAGE_REGION, process.env.DO_SPACES_REGION, process.env.AWS_S3_REGION),
    storage_bucket: firstNonEmpty(cfg.storage_bucket, process.env.STORAGE_BUCKET, process.env.DO_SPACES_BUCKET, process.env.AWS_S3_BUCKET),
    storage_access_key: firstNonEmpty(accessKey, process.env.STORAGE_ACCESS_KEY, process.env.DO_SPACES_ACCESS_KEY_ID, process.env.AWS_ACCESS_KEY_ID),
    storage_secret_key: firstNonEmpty(secretKey, process.env.STORAGE_SECRET_KEY, process.env.DO_SPACES_SECRET_ACCESS_KEY, process.env.AWS_SECRET_ACCESS_KEY),
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
    if (data[key] === undefined) continue;
    const normalized = normalizeValue(data[key]);
    if (!normalized) continue;
    if ((key === 'storage_access_key' || key === 'storage_secret_key') && isMaskedSecret(normalized)) continue;
    await setConfig(key, normalized);
  }
}

export async function testStorageConnection(overrides: Partial<StorageConfig> = {}): Promise<{ success: boolean; message: string }> {
  const storedCfg = await getStorageConfig();
  const overrideAccessKey = normalizeValue(overrides.storage_access_key);
  const overrideSecretKey = normalizeValue(overrides.storage_secret_key);
  const cfg: StorageConfig = {
    storage_provider: firstNonEmpty(overrides.storage_provider, storedCfg.storage_provider),
    storage_endpoint: firstNonEmpty(overrides.storage_endpoint, storedCfg.storage_endpoint),
    storage_region: firstNonEmpty(overrides.storage_region, storedCfg.storage_region),
    storage_bucket: firstNonEmpty(overrides.storage_bucket, storedCfg.storage_bucket),
    storage_access_key: firstNonEmpty(isMaskedSecret(overrideAccessKey) ? '' : overrideAccessKey, storedCfg.storage_access_key),
    storage_secret_key: firstNonEmpty(isMaskedSecret(overrideSecretKey) ? '' : overrideSecretKey, storedCfg.storage_secret_key),
  };
  if (!cfg.storage_endpoint || !cfg.storage_access_key) {
    throw new AppError('Storage is not configured. Save credentials first.', 400, 'STORAGE_NOT_CONFIGURED');
  }

  try {
    const rawEndpoint = cfg.storage_endpoint.startsWith('http://') || cfg.storage_endpoint.startsWith('https://')
      ? cfg.storage_endpoint
      : `https://${cfg.storage_endpoint}`;
    const endpointUrl = new URL(rawEndpoint);
    const provider = cfg.storage_provider.toLowerCase();
    const isDigitalOcean = provider === 'digitalocean' || endpointUrl.hostname.includes('digitaloceanspaces.com');
    if (isDigitalOcean && cfg.storage_bucket) {
      const hostname = endpointUrl.hostname.toLowerCase();
      const bucketPrefix = `${cfg.storage_bucket.toLowerCase()}.`;
      if (hostname.startsWith(bucketPrefix)) {
        endpointUrl.hostname = endpointUrl.hostname.slice(bucketPrefix.length);
      }
    }
    const endpoint = endpointUrl.toString().replace(/\/$/, '');

    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint,
      region: cfg.storage_region || 'us-east-1',
      credentials: {
        accessKeyId: cfg.storage_access_key,
        secretAccessKey: cfg.storage_secret_key,
      },
      forcePathStyle: !isDigitalOcean,
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

// ----- Global Platform Credentials -----

import { GLOBAL_CREDENTIAL_PLATFORMS, type PlatformType } from '@ee-postmind/shared';

export interface PlatformCredentialEntry {
  access_token: string;
  server_key: string;
  client_id: string;
  client_secret: string;
}

export type PlatformCredentials = Record<string, PlatformCredentialEntry>;

const CREDENTIAL_FIELDS: (keyof PlatformCredentialEntry)[] = ['access_token', 'server_key', 'client_id', 'client_secret'];

const PLATFORM_ENV_SYNC_MAP: Partial<Record<
PlatformType,
Partial<Record<keyof PlatformCredentialEntry, string[]>>
>> = {
  facebook: {
    client_id: ['FACEBOOK_APP_ID', 'FACEBOOK_CLIENT_ID'],
    client_secret: ['FACEBOOK_APP_SECRET', 'FACEBOOK_CLIENT_SECRET'],
  },
  instagram: {
    client_id: ['INSTAGRAM_APP_ID'],
    client_secret: ['INSTAGRAM_APP_SECRET'],
  },
  tiktok: {
    client_id: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_ID'],
    client_secret: ['TIKTOK_CLIENT_SECRET', 'TIKTOK_APP_SECRET'],
  },
  linkedin: {
    client_id: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_APP_ID'],
    client_secret: ['LINKEDIN_CLIENT_SECRET', 'LINKEDIN_APP_SECRET'],
  },
  twitter: {
    client_id: ['TWITTER_CLIENT_ID'],
    client_secret: ['TWITTER_CLIENT_SECRET'],
  },
  youtube: {
    client_id: ['YOUTUBE_CLIENT_ID', 'GOOGLE_CLIENT_ID'],
    client_secret: ['YOUTUBE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'],
  },
  pinterest: {
    client_id: ['PINTEREST_CLIENT_ID', 'PINTEREST_APP_ID'],
    client_secret: ['PINTEREST_CLIENT_SECRET', 'PINTEREST_APP_SECRET'],
  },
  telegram: {
    access_token: ['TELEGRAM_BOT_TOKEN'],
    client_id: ['TELEGRAM_CHAT_ID'],
  },
  entreprenrs: {
    access_token: ['ENTREPRENRS_ACCESS_TOKEN'],
    server_key: ['ENTREPRENRS_SERVER_KEY'],
  },
};

function formatEnvValue(value: string): string {
  if (/^[A-Za-z0-9._:/-]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function upsertEnvContent(content: string, updates: Record<string, string>): string {
  const remaining = new Set(Object.keys(updates));
  const lines = content.split(/\r?\n/).map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) return line;
    const key = match[1];
    if (!key || !(key in updates)) return line;
    remaining.delete(key);
    return `${key}=${formatEnvValue(updates[key] ?? '')}`;
  });

  for (const key of remaining) {
    lines.push(`${key}=${formatEnvValue(updates[key] ?? '')}`);
  }

  return lines.join('\n');
}

function syncPlatformCredentialEnvironment(updates: Record<string, string>): void {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;

  for (const [key, value] of entries) {
    process.env[key] = value;
  }

  const envFiles = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];
  const seen = new Set<string>();

  for (const envFile of envFiles) {
    if (seen.has(envFile) || !existsSync(envFile)) continue;
    seen.add(envFile);

    try {
      const current = readFileSync(envFile, 'utf8');
      const next = upsertEnvContent(current, updates);
      if (next === current) continue;
      writeFileSync(envFile, next.endsWith('\n') ? next : `${next}\n`);
    } catch (error) {
      console.warn('[AdminSettings] Unable to sync platform env file:', envFile, error);
    }
  }
}

export async function getPlatformCredentials(): Promise<PlatformCredentials> {
  const cfg = await getConfigGroup('platform_');
  const result: PlatformCredentials = {};
  for (const platform of GLOBAL_CREDENTIAL_PLATFORMS) {
    result[platform] = {
      access_token: cfg[`platform_${platform}_access_token`] || '',
      server_key: cfg[`platform_${platform}_server_key`] || '',
      client_id: cfg[`platform_${platform}_client_id`] || '',
      client_secret: cfg[`platform_${platform}_client_secret`] || '',
    };
  }
  return result;
}

export async function getPlatformCredentialsMasked(): Promise<PlatformCredentials> {
  const creds = await getPlatformCredentials();
  const result: PlatformCredentials = {};
  for (const [platform, entry] of Object.entries(creds)) {
    result[platform] = {
      access_token: maskSecret(entry.access_token),
      server_key: maskSecret(entry.server_key),
      client_id: maskSecret(entry.client_id),
      client_secret: maskSecret(entry.client_secret),
    };
  }
  return result;
}

export async function savePlatformCredentials(data: Record<string, Partial<PlatformCredentialEntry>>): Promise<void> {
  const envUpdates: Record<string, string> = {};

  for (const platform of GLOBAL_CREDENTIAL_PLATFORMS) {
    const entry = data[platform];
    if (!entry) continue;
    for (const field of CREDENTIAL_FIELDS) {
      const value = normalizeValue(entry[field]);
      if (!value || isMaskedSecret(value)) continue;
      await setConfig(`platform_${platform}_${field}`, value);
      const envKeys = PLATFORM_ENV_SYNC_MAP[platform]?.[field] || [];
      for (const envKey of envKeys) {
        envUpdates[envKey] = value;
      }
    }
  }

  syncPlatformCredentialEnvironment(envUpdates);
}

export async function getGlobalCredentialsForPlatform(platform: PlatformType): Promise<string | null> {
  if (!GLOBAL_CREDENTIAL_PLATFORMS.includes(platform)) return null;
  const accessToken = await getConfig(`platform_${platform}_access_token`)
    || (platform === 'entreprenrs'
      ? process.env.ENTREPRENRS_ACCESS_TOKEN || ''
      : platform === 'telegram'
        ? process.env.TELEGRAM_BOT_TOKEN || ''
        : '');
  const serverKey = await getConfig(`platform_${platform}_server_key`)
    || (platform === 'entreprenrs' ? process.env.ENTREPRENRS_SERVER_KEY || '' : '');
  const clientId = await getConfig(`platform_${platform}_client_id`)
    || (platform === 'telegram' ? process.env.TELEGRAM_CHAT_ID || '' : '');

  if (platform === 'entreprenrs') {
    const normalizedAccessToken = normalizeValue(accessToken);
    const normalizedServerKey = normalizeValue(serverKey);
    if (!normalizedAccessToken || !normalizedServerKey) return null;
    return JSON.stringify({ accessToken: normalizedAccessToken, serverKey: normalizedServerKey });
  }

  if (platform === 'telegram') {
    const normalizedBotToken = normalizeValue(accessToken);
    const normalizedChatId = normalizeValue(clientId);
    if (!normalizedBotToken || !normalizedChatId) return null;
    return JSON.stringify({ botToken: normalizedBotToken, chatId: normalizedChatId });
  }

  const normalizedAccessToken = normalizeValue(accessToken);
  if (!normalizedAccessToken) return null;
  const creds: Record<string, string> = { accessToken: normalizedAccessToken };
  const normalizedServerKey = normalizeValue(serverKey);
  if (normalizedServerKey) creds.serverKey = normalizedServerKey;
  return JSON.stringify(creds);
}

export function getGlobalCredentialPlatforms(): PlatformType[] {
  return [...GLOBAL_CREDENTIAL_PLATFORMS];
}

// ============================================================
// Plan Configuration
// ============================================================

export async function getPlanConfig(): Promise<Record<string, any>> {
  const raw = await getConfig('plan_config');
  if (!raw) return {};
  try {
    return JSON.parse(raw, (_k, v) => (v === '__INFINITY__' ? Infinity : v));
  } catch { return {}; }
}

export async function savePlanConfig(config: Record<string, any>): Promise<void> {
  const json = JSON.stringify(config, (_key, value) =>
    value === Infinity ? '__INFINITY__' : value,
  );
  await setConfig('plan_config', json);
}

/**
 * Returns effective limits for a given tier, merging admin-configured
 * overrides from the DB over the hardcoded SUBSCRIPTION_LIMITS defaults.
 */
export async function getEffectiveLimits(tier: string): Promise<{
  socialAccounts: number;
  postsPerMonth: number;
  aiGenerationsPerMonth: number;
  templatesPerMonth: number;
  teamMembers: number;
  analyticsDays: number;
}> {
  const { SUBSCRIPTION_LIMITS } = await import('@ee-postmind/shared');
  const defaults = SUBSCRIPTION_LIMITS[tier as keyof typeof SUBSCRIPTION_LIMITS];
  const config = await getPlanConfig();
  const overrides = config[tier];
  if (!overrides) return { ...defaults };

  return {
    socialAccounts: overrides.socialAccounts ?? defaults.socialAccounts,
    postsPerMonth: overrides.postsPerMonth ?? defaults.postsPerMonth,
    aiGenerationsPerMonth: overrides.aiGenerationsPerMonth ?? defaults.aiGenerationsPerMonth,
    templatesPerMonth: overrides.templatesPerMonth ?? defaults.templatesPerMonth,
    teamMembers: overrides.teamMembers ?? defaults.teamMembers,
    analyticsDays: overrides.analyticsDays ?? defaults.analyticsDays,
  };
}
