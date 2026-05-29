import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.coupon.upsert({
    where: { code: 'ENTREPRENEURS60PRO' },
    update: {
      discountPercent: 60,
      isActive: true,
      allowedPriceKeys: ['pro_6month', 'pro_yearly'],
      maxUsesPerUser: 1
    },
    create: {
      code: 'ENTREPRENEURS60PRO',
      name: 'Entrepreneurs Day Pro 60% Off',
      description: 'Exclusive 60% discount for Entrepreneurs Day on Pro plans (6-month minimum).',
      discountPercent: 60,
      isActive: true,
      allowedPriceKeys: ['pro_6month', 'pro_yearly'],
      maxUsesPerUser: 1,
      requireCardForFreeCheckout: true
    }
  });

  await prisma.coupon.upsert({
    where: { code: 'ENTREPRENEURS60BIZ' },
    update: {
      discountPercent: 60,
      isActive: true,
      allowedPriceKeys: ['business_6month', 'business_yearly'],
      maxUsesPerUser: 1
    },
    create: {
      code: 'ENTREPRENEURS60BIZ',
      name: 'Entrepreneurs Day Biz 60% Off',
      description: 'Exclusive 60% discount for Entrepreneurs Day on Business plans (6-month minimum).',
      discountPercent: 60,
      isActive: true,
      allowedPriceKeys: ['business_6month', 'business_yearly'],
      maxUsesPerUser: 1,
      requireCardForFreeCheckout: true
    }
  });

  await prisma.coupon.upsert({
    where: { code: 'ENTREPRENEURS60ENT' },
    update: {
      discountPercent: 60,
      isActive: true,
      allowedPriceKeys: ['enterprise_6month', 'enterprise_yearly'],
      maxUsesPerUser: 1
    },
    create: {
      code: 'ENTREPRENEURS60ENT',
      name: 'Entrepreneurs Day Enterprise 60% Off',
      description: 'Exclusive 60% discount for Entrepreneurs Day on Enterprise plans (6-month minimum).',
      discountPercent: 60,
      isActive: true,
      allowedPriceKeys: ['enterprise_6month', 'enterprise_yearly'],
      maxUsesPerUser: 1,
      requireCardForFreeCheckout: true
    }
  });

  console.log('Coupons created/updated successfully!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
