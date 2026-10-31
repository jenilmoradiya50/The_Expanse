import { PrismaClient } from "@prisma/client";

/**
 * Creates an extended PrismaClient instance enforcing:
 * 1. Append-only immutable AuditLog records (prohibits update, updateMany, delete, deleteMany, upsert).
 * 2. Consistent query logging across environments.
 */
function createPrismaClient() {
  const isTest = process.env.NODE_ENV === "test";
  const datasourceUrl = isTest
    ? (process.env.TEST_DATABASE_URL || "file:./test.db")
    : process.env.DATABASE_URL;

  const baseClient = new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return baseClient.$extends({
    name: "ImmutableAuditLogExtension",
    query: {
      auditLog: {
        async update() {
          throw new Error("IMMUTABLE_AUDIT_LOG: Audit log records cannot be updated or modified.");
        },
        async updateMany() {
          throw new Error("IMMUTABLE_AUDIT_LOG: Audit log records cannot be updated or modified.");
        },
        async delete() {
          throw new Error("IMMUTABLE_AUDIT_LOG: Audit log records cannot be deleted.");
        },
        async deleteMany() {
          throw new Error("IMMUTABLE_AUDIT_LOG: Audit log records cannot be deleted.");
        },
        async upsert() {
          throw new Error("IMMUTABLE_AUDIT_LOG: Upsert is prohibited on audit logs to prevent record mutation.");
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
