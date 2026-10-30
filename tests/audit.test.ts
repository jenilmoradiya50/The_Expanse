import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { recordAuditLog, getAuditLogs } from "../src/lib/audit";
import { AuditAction, AuditEntity } from "../src/types";

test("Audit Protection - Append-only Creation", async () => {
  const audit = await recordAuditLog({
    action: AuditAction.CREATE,
    entity: AuditEntity.INVOICE,
    entityId: "test-inv-001",
    oldValues: null,
    newValues: { total: 5000, customer: "Test Customer" },
    ipAddress: "127.0.0.1",
    userAgent: "Unit-Test-Runner",
  });

  assert.ok(audit.id, "Audit log ID should be generated");
  assert.equal(audit.action, AuditAction.CREATE);
  assert.equal(audit.entity, AuditEntity.INVOICE);
  assert.equal(audit.entityId, "test-inv-001");

  // Query audit logs
  const logs = await getAuditLogs({ entity: AuditEntity.INVOICE, entityId: "test-inv-001" });
  assert.ok(logs.length >= 1, "Should retrieve the recorded audit log");
});

test("Audit Protection - Prohibit Update", async () => {
  await assert.rejects(
    async () => {
      await prisma.auditLog.update({
        where: { id: "any-id" },
        data: { action: "MUTATED" },
      });
    },
    {
      name: "Error",
      message: /IMMUTABLE_AUDIT_LOG: Audit log records cannot be updated or modified/,
    },
    "Attempting to update an audit log must throw IMMUTABLE_AUDIT_LOG"
  );
});

test("Audit Protection - Prohibit UpdateMany", async () => {
  await assert.rejects(
    async () => {
      await prisma.auditLog.updateMany({
        where: {},
        data: { action: "MUTATED_ALL" },
      });
    },
    {
      name: "Error",
      message: /IMMUTABLE_AUDIT_LOG: Audit log records cannot be updated or modified/,
    },
    "Attempting updateMany on audit logs must throw IMMUTABLE_AUDIT_LOG"
  );
});

test("Audit Protection - Prohibit Delete", async () => {
  await assert.rejects(
    async () => {
      await prisma.auditLog.delete({
        where: { id: "any-id" },
      });
    },
    {
      name: "Error",
      message: /IMMUTABLE_AUDIT_LOG: Audit log records cannot be deleted/,
    },
    "Attempting delete on an audit log must throw IMMUTABLE_AUDIT_LOG"
  );
});

test("Audit Protection - Prohibit DeleteMany", async () => {
  await assert.rejects(
    async () => {
      await prisma.auditLog.deleteMany({
        where: {},
      });
    },
    {
      name: "Error",
      message: /IMMUTABLE_AUDIT_LOG: Audit log records cannot be deleted/,
    },
    "Attempting deleteMany on audit logs must throw IMMUTABLE_AUDIT_LOG"
  );
});

test("Audit Protection - Prohibit Upsert", async () => {
  await assert.rejects(
    async () => {
      await prisma.auditLog.upsert({
        where: { id: "any-id" },
        create: { action: "CREATE", entity: "TEST", entityId: "1" },
        update: { action: "UPDATE" },
      });
    },
    {
      name: "Error",
      message: /IMMUTABLE_AUDIT_LOG: Upsert is prohibited on audit logs to prevent record mutation/,
    },
    "Attempting upsert on audit logs must throw IMMUTABLE_AUDIT_LOG"
  );
});
