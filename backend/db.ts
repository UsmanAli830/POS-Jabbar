import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});

export default prisma;
