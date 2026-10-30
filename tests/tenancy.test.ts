import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  verifyTenantAccess,
  assertPersonalOwnership,
  hasPermission,
  meetsMinimumRole,
  Permissions,
  TenantAuthorizationError,
  PersonalAccessError,
} from "../src/lib/tenancy";
import { Role } from "../src/types";

test("Tenancy - Valid Authorized Member Access", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user, "Seeded user must exist");
  assert.ok(org, "Seeded organization must exist");

  const context = await verifyTenantAccess(user.id, org.id);
  assert.equal(context.userId, user.id);
  assert.equal(context.organizationId, org.id);
  assert.equal(context.role, Role.OWNER);
});

test("Tenancy - Reject Untrusted / Foreign Organization ID", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  assert.ok(user);

  await assert.rejects(
    async () => {
      // Browser supplies a spoofed or unassociated organization ID
      await verifyTenantAccess(user.id, "fake-org-untrusted-id-999");
    },
    (err: unknown) => {
      assert.ok(err instanceof TenantAuthorizationError);
      assert.equal(err.code, "TENANT_ACCESS_DENIED");
      assert.equal(err.status, 403);
      return true;
    },
    "Must reject access to organizations where the user is not a member"
  );
});

test("Tenancy - Reject Unauthenticated User ID", async () => {
  await assert.rejects(
    async () => {
      await verifyTenantAccess("", "some-org-id");
    },
    (err: unknown) => {
      assert.ok(err instanceof TenantAuthorizationError);
      assert.equal(err.code, "UNAUTHENTICATED");
      assert.equal(err.status, 401);
      return true;
    }
  );
});

test("Tenancy - Role Hierarchy & Permissions", () => {
  // Meets minimum role checks
  assert.equal(meetsMinimumRole(Role.OWNER, Role.ADMIN), true);
  assert.equal(meetsMinimumRole(Role.ADMIN, Role.ACCOUNTANT), true);
  assert.equal(meetsMinimumRole(Role.ACCOUNTANT, Role.VIEWER), true);
  assert.equal(meetsMinimumRole(Role.VIEWER, Role.ACCOUNTANT), false);
  assert.equal(meetsMinimumRole(Role.VIEWER, Role.ADMIN), false);

  // Permission checks
  assert.equal(hasPermission(Role.OWNER, Permissions.ORG_DELETE), true);
  assert.equal(hasPermission(Role.ADMIN, Permissions.ORG_DELETE), false);
  assert.equal(hasPermission(Role.ADMIN, Permissions.INVOICE_CREATE), true);
  assert.equal(hasPermission(Role.ACCOUNTANT, Permissions.INVOICE_CREATE), true);
  assert.equal(hasPermission(Role.ACCOUNTANT, Permissions.MEMBER_INVITE), false);
  assert.equal(hasPermission(Role.VIEWER, Permissions.INVOICE_CREATE), false);
  assert.equal(hasPermission(Role.VIEWER, Permissions.INVOICE_VIEW), true);
});

test("Tenancy - Personal Finance Scoping & Isolation", () => {
  const userA = "user-alice-123";
  const userB = "user-bob-456";

  // Accessing own personal finance must pass
  assert.doesNotThrow(() => {
    assertPersonalOwnership(userA, userA);
  });

  // Accessing another user's personal finance must throw PersonalAccessError
  assert.throws(
    () => {
      assertPersonalOwnership(userA, userB);
    },
    (err: unknown) => {
      assert.ok(err instanceof PersonalAccessError);
      assert.equal(err.code, "PERSONAL_BOUNDARY_VIOLATION");
      assert.equal(err.status, 403);
      return true;
    }
  );
});
