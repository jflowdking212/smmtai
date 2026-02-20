import { prisma } from '../config/database.js';
import { deletePublicFileByUrl } from './storage.service.js';
import { getStorageConfig } from './admin-settings.service.js';
import { resolve } from 'path';

const MEDIA_UPLOAD_DIR = resolve(process.env.MEDIA_UPLOAD_DIR || 'uploads');

function resolveRetentionDays(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const IMAGE_RETENTION_DAYS = resolveRetentionDays(process.env.MEDIA_RETENTION_IMAGE_DAYS, 30);
const VIDEO_RETENTION_DAYS = resolveRetentionDays(process.env.MEDIA_RETENTION_VIDEO_DAYS, 20);
const BATCH_SIZE = resolveRetentionDays(process.env.MEDIA_RETENTION_BATCH_SIZE, 200);
const MAX_SCAN = resolveRetentionDays(process.env.MEDIA_RETENTION_MAX_SCAN, 5000);

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function isSiteAssetUrl(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.startsWith('/uploads/site/')) return true;
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.toLowerCase();
    return pathname.startsWith('/uploads/site/') || pathname.includes('/site/');
  } catch {
    return lower.includes('/site/');
  }
}

export interface MediaRetentionResult {
  scanned: number;
  deleted: number;
  skipped: number;
  errors: number;
}

async function purgeWhere(baseWhere: any, storageConfig: any, result: MediaRetentionResult): Promise<void> {
  let cursor: string | null = null;

  while (result.scanned < MAX_SCAN) {
    const where: any = cursor
      ? { AND: [baseWhere, { id: { gt: cursor } }] }
      : baseWhere;

    const records: Array<{ id: string; url: string; type: string }> = await prisma.media.findMany({
      where,
      select: { id: true, url: true, type: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });
    if (records.length === 0) return;

    for (const record of records) {
      result.scanned += 1;
      if (!record.url || typeof record.url !== 'string') {
        result.skipped += 1;
        continue;
      }
      // Retention policy applies only to post attachments; never purge site branding assets.
      if (isSiteAssetUrl(record.url)) {
        result.skipped += 1;
        continue;
      }

      try {
        const deletion = await deletePublicFileByUrl({ url: record.url, localUploadDir: MEDIA_UPLOAD_DIR, storageConfig });
        if (!deletion.deleted) {
          result.skipped += 1;
          continue;
        }

        await prisma.media.delete({ where: { id: record.id } });
        result.deleted += 1;
      } catch (err) {
        result.errors += 1;
        console.error('[MediaRetention] Failed to purge media', {
          mediaId: record.id,
          type: record.type,
          error: err instanceof Error ? err.message : err,
        });
      }

      if (result.scanned >= MAX_SCAN) break;
    }

    cursor = records[records.length - 1]?.id || cursor;
    if (records.length < BATCH_SIZE) return;
  }
}

export async function purgeExpiredMedia(): Promise<MediaRetentionResult> {
  const result: MediaRetentionResult = {
    scanned: 0,
    deleted: 0,
    skipped: 0,
    errors: 0,
  };

  const storageConfig = await getStorageConfig();
  const videoCutoff = daysAgo(VIDEO_RETENTION_DAYS);
  const imageCutoff = daysAgo(IMAGE_RETENTION_DAYS);

  await purgeWhere({
    type: 'video',
    post: {
      publishedAt: { not: null, lt: videoCutoff },
    },
  }, storageConfig, result);

  await purgeWhere({
    type: { not: 'video' },
    post: {
      publishedAt: { not: null, lt: imageCutoff },
    },
  }, storageConfig, result);

  return result;
}
