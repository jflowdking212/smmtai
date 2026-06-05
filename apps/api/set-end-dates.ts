import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const subs = await prisma.subscription.findMany({
    where: {
      status: 'active',
      tier: { not: 'basic' },
      currentPeriodEnd: null,
    }
  });

  console.log('Found ' + subs.length + ' active non-basic subscriptions without an end date.');

  let updatedCount = 0;
  for (const sub of subs) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: sub.workspaceId },
      include: { owner: true }
    });

    if (workspace && workspace.owner && workspace.owner.email === 'judeobidozie@gmail.com') {
      console.log('Skipping system admin subscription for ' + workspace.owner.email);
      continue;
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { currentPeriodEnd: thirtyDaysFromNow }
    });
    updatedCount++;
  }

  console.log('Updated ' + updatedCount + ' subscriptions with an end date of ' + thirtyDaysFromNow.toISOString());
}

main().catch(console.error).finally(() => prisma.$disconnect());
