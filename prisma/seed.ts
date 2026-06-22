import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Skapar en granskaranvändare (REVIEWER) så att feedback-loopens
 * granskningskö kan testas direkt efter migration.
 */
async function main(): Promise<void> {
  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@brevklar.se' },
    update: {},
    create: {
      email: 'reviewer@brevklar.se',
      displayName: 'Granskare Expert',
      role: 'REVIEWER',
      plan: 'B2B',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seedade granskare:', reviewer.id);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
