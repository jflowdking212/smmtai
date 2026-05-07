import { PrismaClient } from '@prisma/client';
import { decrypt } from '../apps/api/src/utils/encryption.ts';

const prisma = new PrismaClient();

async function run() {
  const conn = await prisma.socialConnection.findFirst({
    where: { platform: 'tiktok', isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (conn == null) {
    console.log(JSON.stringify({ status: 'no_active_connection' }, null, 2));
    return;
  }

  const token = decrypt(conn.accessToken);
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));

  console.log(
    JSON.stringify(
      {
        accountName: conn.accountName,
        accountId: conn.accountId,
        httpStatus: res.status,
        creatorInfo: data,
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
