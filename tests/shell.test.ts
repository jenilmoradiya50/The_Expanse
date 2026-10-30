import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { getActiveTenantContext } from "../src/lib/session";
import { getBusinessMetrics, getPersonalMetrics } from "../src/lib/actions";
import { verifyTenantAccess, TenantAuthorizationError } from "../src/lib/tenancy";

test("Phase 3 Shell - Active Tenant Resolution", async () => {
  const context = await getActiveTenantContext();

  assert.ok(context.user.id, "User ID must be present");
  assert.equal(context.user.email, "jenil@theexpanse.local");
  assert.ok(context.activeOrg.id, "Active organization must be resolved");
  assert.ok(context.availableOrgs.length >= 2, "Must list all authorized organizations");

  // Verify that the user is NOT a member of restricted-corp, so it must not be in availableOrgs
  const hasRestricted = context.availableOrgs.some((o) => o.slug === "restricted-corp");
  assert.equal(hasRestricted, false, "Restricted organizations must not appear in user's workspace list");
});

test("Phase 3 Shell - Rejection of Unauthorized Organization ID", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const restrictedOrg = await prisma.organization.findUnique({
    where: { slug: "restricted-corp" },
  });

  assert.ok(user);
  assert.ok(restrictedOrg);

  // Directly requesting restricted org access must throw TenantAuthorizationError
  await assert.rejects(
    async () => {
      await verifyTenantAccess(user.id, restrictedOrg.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof TenantAuthorizationError);
      assert.equal(err.code, "TENANT_ACCESS_DENIED");
      assert.equal(err.status, 403);
      return true;
    },
    "Access to unauthorized organization must be rejected"
  );
});

test("Phase 3 Shell - Fallback Security Handling in getActiveTenantContext", async () => {
  const restrictedOrg = await prisma.organization.findUnique({
    where: { slug: "restricted-corp" },
  });
  assert.ok(restrictedOrg);

  // Passing an explicit unauthorized organization ID must safely fallback to the default org
  const context = await getActiveTenantContext(restrictedOrg.id);

  assert.notEqual(context.activeOrg.id, restrictedOrg.id, "Active org must NOT be set to restricted org");
  assert.ok(context.securityNotice, "Security notice must be emitted on tampering attempt");
  assert.match(context.securityNotice!, /Unauthorized organization ID rejected/);
});

test("Phase 3 Shell - Business vs Personal Domain Metric Separation", async () => {
  const primaryOrg = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(primaryOrg);

  const business = await getBusinessMetrics(primaryOrg.id);
  assert.equal(business.organization.id, primaryOrg.id);
  assert.ok(typeof business.metrics.totalIncome === "number");
  assert.ok(typeof business.metrics.netProfit === "number");

  const personal = await getPersonalMetrics();
  assert.ok(personal.user.id);
  assert.ok(personal.accounts.length >= 3, "Seeded personal accounts must be retrieved");
  assert.ok(typeof personal.metrics.netWorth === "number");

  // Ensure personal accounts do NOT leak into business data
  assert.equal(
    // @ts-expect-error Checking that accounts key does not exist on business metrics
    business.accounts,
    undefined,
    "Business metrics must not contain personal accounts"
  );
});
