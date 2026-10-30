import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { verifyTenantAccess, getUserOrganizations } from "./tenancy";
import type { RoleType } from "@/types";

export const ACTIVE_ORG_COOKIE = "the_expanse_active_org";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isDevDemoSession: boolean;
}

export interface ActiveTenantContext {
  user: AuthenticatedUser;
  activeOrg: {
    id: string;
    name: string;
    slug: string;
    role: RoleType;
    currency: string;
    gstin?: string | null;
  };
  availableOrgs: Array<{
    id: string;
    name: string;
    slug: string;
    role: RoleType;
    isDefault: boolean;
    gstin: string | null;
  }>;
  securityNotice?: string;
}

/**
 * Resolves the authenticated user on the server.
 *
 * SECURITY INVARIANT:
 * This runs strictly on the server and resolves the verified user entity.
 * It NEVER accepts or trusts client-supplied user IDs from request headers
 * or query parameters.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser> {
  // HARD PRODUCTION GUARD: The hardcoded development demo user must never be accepted in production.
  // In production deployments (e.g. Vercel, cloud, or when ALLOW_DEV_DEMO_AUTH is false), reject hardcoded demo credentials.
  const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const allowDevDemo = process.env.ALLOW_DEV_DEMO_AUTH === "true";

  if (isProduction && !allowDevDemo) {
    throw new Error(
      "AUTHENTICATION_REQUIRED: Production authentication provider (e.g. NextAuth/OIDC) must be configured. Development demo credentials are strictly prohibited in production."
    );
  }

  // In development/demo phase, resolve the primary seeded owner user
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new Error("AUTHENTICATION_REQUIRED: No valid user session found. Please run seed.");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "Owner",
    isDevDemoSession: true, // Clearly marked development-only session
  };
}

/**
 * Resolves the active organization context for the authenticated user.
 *
 * SECURITY INVARIANT:
 * 1. Checks all organizations the user holds verified membership in.
 * 2. If a specific organization ID is requested (via cookie or param),
 *    validates membership via `verifyTenantAccess`.
 * 3. Rejects any untrusted or unauthorized organization ID, falling back
 *    to the user's default authorized organization.
 */
export async function getActiveTenantContext(
  explicitOrgId?: string
): Promise<ActiveTenantContext> {
  const user = await getAuthenticatedUser();
  const availableOrgs = await getUserOrganizations(user.id);

  if (availableOrgs.length === 0) {
    throw new Error("NO_ORGANIZATIONS: User is not a member of any organization.");
  }

  // Determine requested org ID: explicit param > cookie > default org
  let cookieOrgId: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  } catch {
    // Gracefully handle calls outside of an HTTP request context (e.g. CLI, automated tests)
    cookieOrgId = undefined;
  }
  const targetOrgId = explicitOrgId || cookieOrgId || availableOrgs[0].id;

  let activeOrgData: ActiveTenantContext["activeOrg"];
  let securityNotice: string | undefined;

  try {
    // Server-side verification: Throws if user is not a member
    const verified = await verifyTenantAccess(user.id, targetOrgId);

    // Fetch currency & GSTIN
    const orgRecord = await prisma.organization.findUnique({
      where: { id: verified.organizationId },
      include: { gstProfile: true },
    });

    activeOrgData = {
      id: verified.organizationId,
      name: verified.organizationName,
      slug: verified.organizationSlug,
      role: verified.role,
      currency: orgRecord?.currency ?? "INR",
      gstin: orgRecord?.gstProfile?.gstin ?? null,
    };
  } catch {
    // Security violation attempt (e.g. user manually altered cookie to another org)
    console.warn(`[SECURITY] Tenant access denied for user ${user.id} to org ${targetOrgId}. Fallback to default.`);
    const fallbackOrg = availableOrgs[0];
    const orgRecord = await prisma.organization.findUnique({
      where: { id: fallbackOrg.id },
      include: { gstProfile: true },
    });

    activeOrgData = {
      id: fallbackOrg.id,
      name: fallbackOrg.name,
      slug: fallbackOrg.slug,
      role: fallbackOrg.role,
      currency: orgRecord?.currency ?? "INR",
      gstin: orgRecord?.gstProfile?.gstin ?? null,
    };

    securityNotice = "Unauthorized organization ID rejected. Reverted to default authorized workspace.";
  }

  return {
    user,
    activeOrg: activeOrgData,
    availableOrgs,
    securityNotice,
  };
}
