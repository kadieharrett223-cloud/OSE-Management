const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:./dev.db' } } });

prisma.user.updateMany({ data: { role: 'ADMIN' } })
  .then(() => {
    console.log('✓ All users updated to ADMIN');
    return prisma.$disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
