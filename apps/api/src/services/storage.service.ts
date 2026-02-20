import { mkdir, writeFile, unlink } from 'fs/promises';
import { dirname, resolve } from 'path';
import { getStorageConfig, type StorageConfig } from './admin-settings.service.js';

export type UploadedStorageProvider = 'local' | 's3';

export interface PublicUploadResult {
  url: string;
  key: string;
  provider: UploadedStorageProvider;
}

export type PublicDeleteProvider = UploadedStorageProvider | 'unknown';

export interface PublicDeleteResult {
  deleted: boolean;
  provider: PublicDeleteProvider;
  key?: string;
}

function normalizeObjectKey(key: string): string {
  return key.replace(/^\/+/, '').replace(/\\/g, '/');
}

function isStorageConfigured(cfg: StorageConfig): boolean {
  return Boolean(
    cfg.storage_endpoint?.trim()
    && cfg.storage_bucket?.trim()
    && cfg.storage_access_key?.trim()
    && cfg.storage_secret_key?.trim(),
  );
}

function resolveEndpoint(cfg: StorageConfig): {
  endpoint: string;
  region: string;
  bucket: string;
  forcePathStyle: boolean;
  publicBaseUrl: string;
} {
  const rawEndpoint = cfg.storage_endpoint.startsWith('http://') || cfg.storage_endpoint.startsWith('https://')
    ? cfg.storage_endpoint
    : `https://${cfg.storage_endpoint}`;
  const endpointUrl = new URL(rawEndpoint);
  const provider = (cfg.storage_provider || '').toLowerCase();
  const isDigitalOcean = provider === 'digitalocean' || endpointUrl.hostname.includes('digitaloceanspaces.com');

  if (isDigitalOcean && cfg.storage_bucket) {
    const hostname = endpointUrl.hostname.toLowerCase();
    const bucketPrefix = `${cfg.storage_bucket.toLowerCase()}.`;
    if (hostname.startsWith(bucketPrefix)) {
      endpointUrl.hostname = endpointUrl.hostname.slice(bucketPrefix.length);
    }
  }

  const endpoint = endpointUrl.toString().replace(/\/$/, '');
  const forcePathStyle = !isDigitalOcean;
  const publicBaseUrl = forcePathStyle
    ? `${endpoint}/${cfg.storage_bucket}`
    : `${endpointUrl.protocol}//${cfg.storage_bucket}.${endpointUrl.host}`;

  return {
    endpoint,
    region: cfg.storage_region || 'us-east-1',
    bucket: cfg.storage_bucket,
    forcePathStyle,
    publicBaseUrl,
  };
}

async function uploadToLocal(params: {
  buffer: Buffer;
  key: string;
  baseUrl: string;
  uploadDir: string;
}): Promise<PublicUploadResult> {
  const normalizedKey = normalizeObjectKey(params.key);
  const destPath = resolve(params.uploadDir, normalizedKey);
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, params.buffer);

  const baseUrl = params.baseUrl.replace(/\/$/, '');
  return {
    url: `${baseUrl}/uploads/${normalizedKey}`,
    key: normalizedKey,
    provider: 'local',
  };
}

async function uploadToS3(params: {
  buffer: Buffer;
  key: string;
  contentType: string;
  cfg: StorageConfig;
}): Promise<PublicUploadResult> {
  const normalizedKey = normalizeObjectKey(params.key);
  const { endpoint, region, bucket, forcePathStyle, publicBaseUrl } = resolveEndpoint(params.cfg);

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: params.cfg.storage_access_key,
      secretAccessKey: params.cfg.storage_secret_key,
    },
    forcePathStyle,
  });

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: normalizedKey,
    Body: params.buffer,
    ContentType: params.contentType || 'application/octet-stream',
  }));

  return {
    url: `${publicBaseUrl}/${normalizedKey}`,
    key: normalizedKey,
    provider: 's3',
  };
}

export async function uploadPublicFile(params: {
  buffer: Buffer;
  key: string;
  contentType: string;
  baseUrl: string;
  localUploadDir: string;
}): Promise<PublicUploadResult> {
  const cfg = await getStorageConfig();

  if (!isStorageConfigured(cfg)) {
    return uploadToLocal({
      buffer: params.buffer,
      key: params.key,
      baseUrl: params.baseUrl,
      uploadDir: params.localUploadDir,
    });
  }

  return uploadToS3({
    buffer: params.buffer,
    key: params.key,
    contentType: params.contentType,
    cfg,
  });
}

function extractLocalKeyFromUrl(value: string): string | null {
  if (!value) return null;
  if (value.startsWith('/uploads/')) return value.slice('/uploads/'.length);
  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/uploads/')) {
      return parsed.pathname.slice('/uploads/'.length);
    }
  } catch {
    // ignore
  }
  return null;
}

export async function deletePublicFileByUrl(params: {
  url: string;
  localUploadDir: string;
  storageConfig?: StorageConfig;
}): Promise<PublicDeleteResult> {
  const localKey = extractLocalKeyFromUrl(params.url);
  if (localKey) {
    const root = resolve(params.localUploadDir);
    const destPath = resolve(root, decodeURIComponent(localKey));
    if (!destPath.startsWith(root + '/')) {
      throw new Error('Refusing to delete path outside upload directory');
    }

    try {
      await unlink(destPath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }

    return { deleted: true, provider: 'local', key: localKey };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(params.url);
  } catch {
    return { deleted: false, provider: 'unknown' };
  }

  const cfg = params.storageConfig ?? await getStorageConfig();
  if (!isStorageConfigured(cfg)) {
    return { deleted: false, provider: 'unknown' };
  }

  const { endpoint, region, bucket, forcePathStyle, publicBaseUrl } = resolveEndpoint(cfg);
  const base = new URL(publicBaseUrl);
  if (parsedUrl.hostname !== base.hostname) {
    return { deleted: false, provider: 'unknown' };
  }

  const basePath = base.pathname.replace(/\/$/, '');
  const pathname = parsedUrl.pathname;
  const key = basePath && basePath !== '/'
    ? pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length + 1) : ''
    : pathname.replace(/^\/+/, '');
  if (!key) {
    return { deleted: false, provider: 'unknown' };
  }

  const normalizedKey = decodeURIComponent(key);
  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: cfg.storage_access_key,
      secretAccessKey: cfg.storage_secret_key,
    },
    forcePathStyle,
  });

  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: normalizedKey,
  }));

  return { deleted: true, provider: 's3', key: normalizedKey };
}
