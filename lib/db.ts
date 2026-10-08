import * as Prisma from "@prisma/client";

const { PrismaClient } = Prisma as any;
const globalForPrisma = globalThis as unknown as { prisma: any };

export const db = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
