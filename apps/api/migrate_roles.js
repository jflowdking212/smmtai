const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const members = await prisma.workspaceMember.findMany({
    include: { workspace: true }
  });

  let updatedCount = 0;

  for (const member of members) {
    let newRole = member.role;

    if (member.userId === member.workspace.ownerId) {
      newRole = 'owner';
    } else if (member.role === 'admin') {
      newRole = 'manager';
    } else if (member.role === 'editor') {
      newRole = 'creator';
    }

    if (newRole !== member.role) {
      await prisma.workspaceMember.update({
        where: { id: member.id },
        data: { role: newRole }
      });
      console.log(`Updated user ${member.userId} in workspace ${member.workspaceId} from ${member.role} to ${newRole}`);
      updatedCount++;
    }
  }

  console.log(`Finished updating ${updatedCount} members.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
