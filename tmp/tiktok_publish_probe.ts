import { PrismaClient } from '@prisma/client';
import { decrypt } from '../apps/api/src/utils/encryption.ts';

const prisma = new PrismaClient();

async function callInit(token: string, imageUrl: string, privacyLevel: string) {
  const payload = {
    post_info: {
      title: 'Probe post from EE PostMind',
      description: 'Probe post from EE PostMind #test',
      privacy_level: privacyLevel,
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
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    privacyLevel,
    data,
  };
}

async function run() {
  const conn = await prisma.socialConnection.findFirst({
    where: { platform: 'tiktok', isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (conn == null) {
    console.log(JSON.stringify({ status: 'no_active_connection' }, null, 2));
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

  const imageUrl = latestMedia?.post?.media?.[0]?.url;
  if (!imageUrl) {
    console.log(JSON.stringify({ status: 'no_media_found' }, null, 2));
    return;
  }

  const token = decrypt(conn.accessToken);

  const creatorRes = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const creatorData = await creatorRes.json().catch(() => ({}));

  const selfOnlyAttempt = await callInit(token, imageUrl, 'SELF_ONLY');
  const publicAttempt = await callInit(token, imageUrl, 'PUBLIC_TO_EVERYONE');

  console.log(
    JSON.stringify(
      {
        accountName: conn.accountName,
        accountId: conn.accountId,
        imageUrl,
        creatorInfoStatus: creatorRes.status,
        creatorInfo: creatorData,
        selfOnlyAttempt,
        publicAttempt,
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
