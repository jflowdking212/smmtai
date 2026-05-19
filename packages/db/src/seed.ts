import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

function getDatabaseUrlFromEnvFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^DATABASE_URL=(.+)$/m);
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

if (!process.env.DATABASE_URL) {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../../apps/api/.env'),
  ];

  const discovered = candidates
    .map((candidate) => ({ candidate, value: getDatabaseUrlFromEnvFile(candidate) }))
    .find(({ value }) => !!value);

  if (discovered?.value) {
    process.env.DATABASE_URL = discovered.value;
    console.warn(`DATABASE_URL loaded from ${discovered.candidate}`);
  } else {
    process.env.DATABASE_URL = 'postgresql://smmtai:smmtai@localhost:5432/ee_smmtai?schema=public';
    console.warn('DATABASE_URL not set. Using local default: postgresql://smmtai@localhost:5432/ee_smmtai');
  }
}

const prisma = new PrismaClient();

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL || 'demo@smmtai.local';
const DEMO_NAME = process.env.SEED_DEMO_NAME || 'SmmtAI Demo';
const DEMO_WORKSPACE_NAME = process.env.SEED_WORKSPACE_NAME || 'Demo Workspace';
const DEMO_WORKSPACE_SLUG = process.env.SEED_WORKSPACE_SLUG || 'demo-workspace';

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: DEMO_NAME, emailVerified: true },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      emailVerified: true,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: DEMO_WORKSPACE_SLUG },
    update: {
      name: DEMO_WORKSPACE_NAME,
      ownerId: user.id,
    },
    create: {
      name: DEMO_WORKSPACE_NAME,
      slug: DEMO_WORKSPACE_SLUG,
      ownerId: user.id,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    },
    update: { role: 'owner' },
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      role: 'owner',
    },
  });

  await prisma.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: { tier: 'basic', status: 'active' },
    create: {
      workspaceId: workspace.id,
      tier: 'basic',
      status: 'active',
    },
  });

  console.log(`Seed complete for ${DEMO_EMAIL} in workspace ${DEMO_WORKSPACE_SLUG}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
