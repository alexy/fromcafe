import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with appropriate configuration
function createPrismaClient() {
  const isDevelopment = process.env.NODE_ENV !== 'production'
  
  return new PrismaClient({
    log: isDevelopment ? ['query'] : ['error'],
    errorFormat: 'pretty',
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma