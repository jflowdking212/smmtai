import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.systemConfig.findMany();

  for (const config of configs) {
    if (!config.encrypted && config.value && (config.value.includes('EE PostMind') || config.value.includes('PostMind') || config.value.includes('Postmind'))) {
      let newValue = config.value.replace(/EE PostMind/g, 'SmmtAI')
                                 .replace(/PostMind/g, 'SmmtAI')
                                 .replace(/Postmind/g, 'SmmtAI');
      
      await prisma.systemConfig.update({
        where: { key: config.key },
        data: { value: newValue }
      });
      console.log(`Updated SystemConfig key ${config.key} to ${newValue}`);
    }
  }

  // Double check workspace names
  const workspaces = await prisma.workspace.findMany();
  for (const w of workspaces) {
    if (w.name.includes('PostMind') || w.name.includes('Postmind')) {
      let newName = w.name.replace(/EE PostMind/g, 'SmmtAI')
                          .replace(/PostMind/g, 'SmmtAI')
                          .replace(/Postmind/g, 'SmmtAI');
      await prisma.workspace.update({
        where: { id: w.id },
        data: { name: newName }
      });
      console.log(`Updated workspace name to ${newName}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
