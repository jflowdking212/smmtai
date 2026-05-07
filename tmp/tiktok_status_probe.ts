import { PrismaClient } from '@prisma/client';
import { decrypt } from '../apps/api/src/utils/encryption.ts';

const prisma = new PrismaClient();

async function run() {
  const conn = await prisma.socialConnection.findFirst({ where: { platform: 'tiktok', isActive: true }, orderBy: { updatedAt: 'desc' } });
  const post = await prisma.platformPost.findFirst({ where: { platform: 'tiktok', status: 'published' }, orderBy: { createdAt: 'desc' } });

  if (!conn || !post?.platformPostId) {
    console.log(JSON.stringify({ error: 'MISSING_CONNECTION_OR_PUBLISH_ID' }, null, 2));
    return;
  }

  const token = decrypt(conn.accessToken);
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ publish_id: post.platformPostId }),
  });
  const data = await res.json().catch(() => ({}));
  console.log(JSON.stringify({ publishId: post.platformPostId, status: res.status, data }, null, 2));
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
