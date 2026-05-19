import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.systemConfig.findMany();
  console.log('Current configs:', configs);

  for (const config of configs) {
    if (config.key === 'site_title' && (config.value === 'EE PostMind' || config.value === 'PostMind' || config.value === 'Postmind')) {
      await prisma.systemConfig.update({
        where: { key: 'site_title' },
        data: { value: 'SmmtAI' }
      });
      console.log('Updated site_title to SmmtAI');
    }
  }

  // Also update knowledge base if there are old entries
  const kbs = await prisma.knowledgeBase.findMany();
  for (const kb of kbs) {
    let changed = false;
    let newTitle = kb.title;
    let newContent = kb.content;

    if (newTitle.includes('EE PostMind') || newTitle.includes('PostMind')) {
      newTitle = newTitle.replace(/EE PostMind/g, 'SmmtAI').replace(/PostMind/g, 'SmmtAI');
      changed = true;
    }

    if (newContent.includes('EE PostMind') || newContent.includes('PostMind')) {
      newContent = newContent.replace(/EE PostMind/g, 'SmmtAI').replace(/PostMind/g, 'SmmtAI');
      changed = true;
    }

    if (changed) {
      await prisma.knowledgeBase.update({
        where: { id: kb.id },
        data: { title: newTitle, content: newContent }
      });
      console.log('Updated KB article:', kb.title);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
