const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.systemConfig.findUnique({ where: { key: 'plan_config' } })
  .then(c => {
    console.log("PLAN_CONFIG_RESULT:");
    console.log(c ? c.value : 'null');
  })
  .catch(err => {
    console.error(err);
  })
  .finally(() => {
    prisma.$disconnect();
  });
