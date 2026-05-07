import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../apps/api/src/utils/encryption.ts';

const prisma = new PrismaClient();

function makeProxyUrl(rawUrl: string) {
  const base = (process.env.TIKTOK_MEDIA_PROXY_BASE_URL || process.env.FRONTEND_URL || '').replace(/\/+$/g, '');
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const secret = process.env.TIKTOK_MEDIA_PROXY_SECRET || process.env.JWT_SECRET || 'ee-postmind-tiktok-media-proxy';
  const sig = crypto.createHmac('sha256', secret).update(`${rawUrl}|${expires}`).digest('hex');
  const qs = new URLSearchParams({ url: rawUrl, expires: String(expires), sig });
  return `${base}/api/v1/posts/media/tiktok-proxy?${qs.toString()}`;
}

async function tiktokInit(token: string, imageUrl: string) {
  const payload = {
    post_info: {
      title: 'EE PostMind TikTok proxy probe',
      description: 'EE PostMind TikTok proxy probe',
      privacy_level: 'SELF_ONLY',
      disable_comment: false,
      auto_add_music: false,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      photo_cover_index: 0,
      photo_images: [imageUrl],
    },
    post_mode: 'DIRECT_POST',
    media_type: 'PHOTO',
  };

  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  const conn = await prisma.socialConnection.findFirst({
    where: { platform: 'tiktok', isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!conn) {
    console.log(JSON.stringify({ error: 'NO_ACTIVE_TIKTOK_CONNECTION' }, null, 2));
    return;
  }

  const latestMedia = await prisma.platformPost.findFirst({
    where: { platform: 'tiktok' },
    orderBy: { createdAt: 'desc' },
    select: {
      post: {
        select: {
          media: {
            orderBy: { order: 'asc' },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  });

  const rawUrl = latestMedia?.post?.media?.[0]?.url;
  if (!rawUrl) {
    console.log(JSON.stringify({ error: 'NO_MEDIA_URL_FOUND' }, null, 2));
    return;
  }

  const token = decrypt(conn.accessToken);
  const proxiedUrl = makeProxyUrl(rawUrl);

  const [rawAttempt, proxyAttempt] = await Promise.all([
    tiktokInit(token, rawUrl),
    tiktokInit(token, proxiedUrl),
  ]);

  console.log(
    JSON.stringify(
      {
        accountName: conn.accountName,
        accountId: conn.accountId,
        rawUrl,
        proxiedUrl,
        rawAttempt,
        proxyAttempt,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
