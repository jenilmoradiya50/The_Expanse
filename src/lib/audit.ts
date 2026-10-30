import { prisma } from "./prisma";
import type { AuditActionType, AuditEntityType } from "@/types";

export interface CreateAuditLogParams {
  organizationId?: string | null;
  userId?: string | null;
  action: AuditActionType;
  entity: AuditEntityType;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditQueryFilter {
  organizationId?: string;
  userId?: string;
  entity?: AuditEntityType;
  entityId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Records an immutable audit log entry.
 * Audit records cannot be modified or deleted once persisted.
 */
export async function recordAuditLog(params: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValues: params.oldValues ? JSON.stringify(params.oldValues) : null,
        newValues: params.newValues ? JSON.stringify(params.newValues) : null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to record audit log:", error);
    throw error;
  }
}

/**
 * Queries audit log history with pagination and tenant filtering.
 */
export async function getAuditLogs(filter: AuditQueryFilter) {
  const { organizationId, userId, entity, entityId, limit = 50, offset = 0 } = filter;

  return await prisma.auditLog.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      ...(userId ? { userId } : {}),
      ...(entity ? { entity } : {}),
      ...(entityId ? { entityId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    skip: offset,
  });
}
