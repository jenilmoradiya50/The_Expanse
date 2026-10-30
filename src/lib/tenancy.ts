import { prisma } from "./prisma";
import { Role, type RoleType } from "@/types";

export class TenantAuthorizationError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status = 403) {
    super(message);
    this.name = "TenantAuthorizationError";
    this.code = code;
    this.status = status;
  }
}

export class PersonalAccessError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status = 403) {
    super(message);
    this.name = "PersonalAccessError";
    this.code = code;
    this.status = status;
  }
}

// Role Hierarchy Weighting
const ROLE_WEIGHTS: Record<RoleType, number> = {
  [Role.VIEWER]: 1,
  [Role.ACCOUNTANT]: 2,
  [Role.ADMIN]: 3,
  [Role.OWNER]: 4,
};

export const Permissions = {
  // Tenancy & Organization
  ORG_VIEW: "ORG_VIEW",
  ORG_UPDATE: "ORG_UPDATE",
  ORG_DELETE: "ORG_DELETE",
  MEMBER_INVITE: "MEMBER_INVITE",
  MEMBER_MANAGE: "MEMBER_MANAGE",

  // Business Operations
  PRODUCT_MANAGE: "PRODUCT_MANAGE",
  ORDER_VIEW: "ORDER_VIEW",
  ORDER_CREATE: "ORDER_CREATE",
  ORDER_UPDATE: "ORDER_UPDATE",
  ORDER_DELETE: "ORDER_DELETE",
  INVOICE_VIEW: "INVOICE_VIEW",
  INVOICE_CREATE: "INVOICE_CREATE",
  INVOICE_UPDATE: "INVOICE_UPDATE",
  INVOICE_DELETE: "INVOICE_DELETE",
  PAYMENT_VIEW: "PAYMENT_VIEW",
  PAYMENT_CREATE: "PAYMENT_CREATE",
  PAYMENT_DELETE: "PAYMENT_DELETE",
  EXPENSE_VIEW: "EXPENSE_VIEW",
  EXPENSE_CREATE: "EXPENSE_CREATE",
  EXPENSE_UPDATE: "EXPENSE_UPDATE",
  EXPENSE_DELETE: "EXPENSE_DELETE",
  CUSTOMER_MANAGE: "CUSTOMER_MANAGE",
  VENDOR_MANAGE: "VENDOR_MANAGE",

  // Compliance & Reporting
  GST_PROFILE_MANAGE: "GST_PROFILE_MANAGE",
  REPORT_VIEW: "REPORT_VIEW",
  AUDIT_LOG_VIEW: "AUDIT_LOG_VIEW",
} as const;

export type PermissionType = (typeof Permissions)[keyof typeof Permissions];

const ROLE_PERMISSIONS: Record<RoleType, Set<PermissionType>> = {
  [Role.VIEWER]: new Set([
    Permissions.ORG_VIEW,
    Permissions.INVOICE_VIEW,
    Permissions.ORDER_VIEW,
    Permissions.PAYMENT_VIEW,
    Permissions.EXPENSE_VIEW,
    Permissions.REPORT_VIEW,
  ]),
  [Role.ACCOUNTANT]: new Set([
    Permissions.ORG_VIEW,
    Permissions.PRODUCT_MANAGE,
    Permissions.ORDER_VIEW,
    Permissions.ORDER_CREATE,
    Permissions.ORDER_UPDATE,
    Permissions.INVOICE_VIEW,
    Permissions.INVOICE_CREATE,
    Permissions.INVOICE_UPDATE,
    Permissions.PAYMENT_VIEW,
    Permissions.PAYMENT_CREATE,
    Permissions.EXPENSE_VIEW,
    Permissions.EXPENSE_CREATE,
    Permissions.EXPENSE_UPDATE,
    Permissions.CUSTOMER_MANAGE,
    Permissions.VENDOR_MANAGE,
    Permissions.REPORT_VIEW,
    Permissions.AUDIT_LOG_VIEW,
  ]),
  [Role.ADMIN]: new Set([
    Permissions.ORG_VIEW,
    Permissions.ORG_UPDATE,
    Permissions.MEMBER_INVITE,
    Permissions.MEMBER_MANAGE,
    Permissions.PRODUCT_MANAGE,
    Permissions.ORDER_VIEW,
    Permissions.ORDER_CREATE,
    Permissions.ORDER_UPDATE,
    Permissions.ORDER_DELETE,
    Permissions.INVOICE_VIEW,
    Permissions.INVOICE_CREATE,
    Permissions.INVOICE_UPDATE,
    Permissions.INVOICE_DELETE,
    Permissions.PAYMENT_VIEW,
    Permissions.PAYMENT_CREATE,
    Permissions.PAYMENT_DELETE,
    Permissions.EXPENSE_VIEW,
    Permissions.EXPENSE_CREATE,
    Permissions.EXPENSE_UPDATE,
    Permissions.EXPENSE_DELETE,
    Permissions.CUSTOMER_MANAGE,
    Permissions.VENDOR_MANAGE,
    Permissions.GST_PROFILE_MANAGE,
    Permissions.REPORT_VIEW,
    Permissions.AUDIT_LOG_VIEW,
  ]),
  [Role.OWNER]: new Set(Object.values(Permissions)),
};

/**
 * Checks whether a given role grants a specific permission.
 */
export function hasPermission(role: RoleType, permission: PermissionType): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * Verifies that a user's role meets or exceeds a required role level.
 */
export function meetsMinimumRole(currentRole: RoleType, requiredRole: RoleType): boolean {
  const currentWeight = ROLE_WEIGHTS[currentRole] ?? 0;
  const requiredWeight = ROLE_WEIGHTS[requiredRole] ?? 0;
  return currentWeight >= requiredWeight;
}

export interface VerifiedTenantContext {
  userId: string;
  organizationId: string;
  role: RoleType;
  organizationName: string;
  organizationSlug: string;
}

/**
 * Server-side authorization check for multi-tenant isolation.
 *
 * CRITICAL SECURITY INVARIANT:
 * Never trusts client-supplied organization IDs. This function always verifies
 * that the authenticated user holds an active membership record in the target organization.
 */
export async function verifyTenantAccess(
  userId: string,
  organizationId: string,
  requiredRole?: RoleType
): Promise<VerifiedTenantContext> {
  if (!userId || typeof userId !== "string") {
    throw new TenantAuthorizationError(
      "UNAUTHENTICATED",
      "Valid authenticated user identity required for tenant operations.",
      401
    );
  }

  if (!organizationId || typeof organizationId !== "string") {
    throw new TenantAuthorizationError(
      "INVALID_TENANT_ID",
      "A valid organization identifier must be provided.",
      400
    );
  }

  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!membership || !membership.organization) {
    throw new TenantAuthorizationError(
      "TENANT_ACCESS_DENIED",
      "Access denied: User is not an authorized member of the requested organization.",
      403
    );
  }

  const userRole = membership.role as RoleType;

  if (requiredRole && !meetsMinimumRole(userRole, requiredRole)) {
    throw new TenantAuthorizationError(
      "INSUFFICIENT_ROLE_PERMISSIONS",
      `Operation requires minimum role '${requiredRole}'. Current role: '${userRole}'.`,
      403
    );
  }

  return {
    userId,
    organizationId: membership.organization.id,
    role: userRole,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
  };
}

/**
 * Asserts that a personal finance operation belongs exclusively to the authenticated user.
 * Personal records must never be accessed across user boundaries.
 */
export function assertPersonalOwnership(authenticatedUserId: string, targetUserId: string): void {
  if (!authenticatedUserId || authenticatedUserId !== targetUserId) {
    throw new PersonalAccessError(
      "PERSONAL_BOUNDARY_VIOLATION",
      "Personal financial records can only be accessed by their account owner.",
      403
    );
  }
}

/**
 * Fetches all organizations the user belongs to, verifying membership on the server.
 */
export async function getUserOrganizations(userId: string) {
  if (!userId) return [];

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          gstProfile: {
            select: {
              gstin: true,
              stateCode: true,
              legalName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role as RoleType,
    isDefault: m.isDefault,
    gstin: m.organization.gstProfile?.gstin ?? null,
  }));
}
