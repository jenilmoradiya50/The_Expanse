import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  createCustomer,
  createVendor,
  archiveCustomer,
  archiveVendor,
  createOrder,
  createInvoice,
  recordPayment,
  reconcileCustomerBalance,
  reconcileVendorBalance,
} from "../src/lib/business";
import { getBusinessMetrics } from "../src/lib/actions";
import { getAuthenticatedUser } from "../src/lib/session";

test("Integrity - Simultaneous Payments Prevent Overpayment and Race Condition", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const customer = await createCustomer(user.id, org.id, {
    name: `Simultaneous Pay Customer ${Date.now()}`,
  });

  // Invoice for ₹10,000 total (0% GST for direct numerical precision)
  const invoice = await createInvoice(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Standard Hardware Bundle",
        hsnSacCode: "8471",
        quantity: 1,
        unitPrice: 10000,
        gstRate: 0,
      },
    ],
  });

  assert.equal(invoice.grandTotal, 10000);

  // Attempt two concurrent payments of ₹6,000 each on a ₹10,000 invoice (Total ₹12,000 > ₹10,000)
  const [res1, res2] = await Promise.allSettled([
    recordPayment(user.id, org.id, {
      type: "INCOMING",
      invoiceId: invoice.id,
      amount: 6000,
      paymentDate: new Date(),
      referenceNumber: `UTR-SIM-1-${Date.now()}`,
    }),
    recordPayment(user.id, org.id, {
      type: "INCOMING",
      invoiceId: invoice.id,
      amount: 6000,
      paymentDate: new Date(),
      referenceNumber: `UTR-SIM-2-${Date.now()}`,
    }),
  ]);

  // Exactly one payment must succeed, and one must be rejected (either PAYMENT_EXCEEDS_BALANCE or CONCURRENT_PAYMENT_CONFLICT)
  const succeeded = [res1, res2].filter((r) => r.status === "fulfilled");
  const rejected = [res1, res2].filter((r) => r.status === "rejected");

  assert.equal(succeeded.length, 1, "Exactly one concurrent payment must succeed");
  assert.equal(rejected.length, 1, "The second concurrent payment must fail");

  const errMessage = (rejected[0] as PromiseRejectedResult).reason?.message;
  assert.match(
    errMessage,
    /PAYMENT_EXCEEDS_BALANCE|CONCURRENT_PAYMENT_CONFLICT/,
    "Error must be PAYMENT_EXCEEDS_BALANCE or CONCURRENT_PAYMENT_CONFLICT"
  );

  // Verify invoice amountPaid is strictly 6,000
  const refreshedInv = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  assert.equal(refreshedInv?.amountPaid, 6000);
  assert.equal(refreshedInv?.status, "PARTIALLY_PAID");

  // Verify customer balance reflects exactly 10,000 - 6,000 = 4,000
  const refreshedCust = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.equal(refreshedCust?.balance, 4000);
});

test("Integrity - Concurrent Document Numbering Generates Unique Sequences Without Collisions", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const customer = await createCustomer(user.id, org.id, {
    name: `Concurrent Numbering Customer ${Date.now()}`,
  });

  // Launch 5 simultaneous invoice creations
  const promises = Array.from({ length: 5 }, (_, i) =>
    createInvoice(user.id, org.id, {
      type: "SALES",
      customerId: customer.id,
      invoiceDate: new Date(),
      dueDate: new Date(),
      placeOfSupply: "24",
      items: [
        {
          description: `Item ${i + 1}`,
          hsnSacCode: "998314",
          quantity: 1,
          unitPrice: 1000 * (i + 1),
          gstRate: 0,
        },
      ],
    })
  );

  const results = await Promise.all(promises);
  assert.equal(results.length, 5);

  const invoiceNumbers = results.map((inv) => inv.invoiceNumber);
  const uniqueNumbers = new Set(invoiceNumbers);

  // All 5 must have unique invoice numbers
  assert.equal(uniqueNumbers.size, 5, "All 5 concurrent invoices must have distinct sequential numbers");

  // Verify consecutive sequence numbers
  const seqs = invoiceNumbers.map((num) => {
    const parts = num.split("-");
    return parseInt(parts[parts.length - 1], 10);
  });
  seqs.sort((a, b) => a - b);

  for (let i = 1; i < seqs.length; i++) {
    assert.equal(seqs[i], seqs[i - 1] + 1, "Sequence numbers must be strictly consecutive");
  }
});

test("Integrity - Concurrent Duplicate GSTIN Creation Rejected at Database Level", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const testGstin = `24CONCU${Math.floor(1000 + Math.random() * 9000)}A1Z5`;

  // Attempt simultaneous customer creation with identical GSTIN
  const [res1, res2] = await Promise.allSettled([
    createCustomer(user.id, org.id, {
      name: "Concurrent Customer A",
      gstin: testGstin,
    }),
    createCustomer(user.id, org.id, {
      name: "Concurrent Customer B",
      gstin: testGstin,
    }),
  ]);

  const succeeded = [res1, res2].filter((r) => r.status === "fulfilled");
  const rejected = [res1, res2].filter((r) => r.status === "rejected");

  assert.equal(succeeded.length, 1, "Exactly one customer creation must succeed");
  assert.equal(rejected.length, 1, "The duplicate customer creation must be rejected");

  const err = (rejected[0] as PromiseRejectedResult).reason?.message;
  assert.match(err, /DUPLICATE_GSTIN/, "Error message must indicate duplicate GSTIN");

  // Database verification: Only 1 customer exists with that GSTIN in org
  const matching = await prisma.customer.findMany({
    where: { organizationId: org.id, gstin: testGstin },
  });
  assert.equal(matching.length, 1);
});

test("Integrity - Database Level Duplicate Payment Reference Rejection & Null Handling", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const customer = await createCustomer(user.id, org.id, {
    name: `Duplicate Ref Customer ${Date.now()}`,
  });

  const uniqueRef = `UTR-INTEGRITY-${Date.now()}`;

  // 1. Record first payment with uniqueRef
  const payment1 = await recordPayment(user.id, org.id, {
    type: "INCOMING",
    customerId: customer.id,
    amount: 1500,
    paymentDate: new Date(),
    referenceNumber: uniqueRef,
  });
  assert.ok(payment1.id);

  // 2. Attempt duplicate reference in same organization -> must be rejected
  await assert.rejects(
    async () => {
      await recordPayment(user.id, org.id, {
        type: "INCOMING",
        customerId: customer.id,
        amount: 1500,
        paymentDate: new Date(),
        referenceNumber: uniqueRef,
      });
    },
    {
      name: "Error",
      message: /DUPLICATE_PAYMENT/,
    },
    "Payment with duplicate reference number in same organization must throw DUPLICATE_PAYMENT"
  );

  // 3. Nullable references: Two payments with null / empty references MUST be allowed
  const paymentNull1 = await recordPayment(user.id, org.id, {
    type: "INCOMING",
    customerId: customer.id,
    amount: 500,
    paymentDate: new Date(),
    referenceNumber: null,
  });
  const paymentNull2 = await recordPayment(user.id, org.id, {
    type: "INCOMING",
    customerId: customer.id,
    amount: 500,
    paymentDate: new Date(),
    referenceNumber: "",
  });

  assert.ok(paymentNull1.id);
  assert.ok(paymentNull2.id);
  assert.equal(paymentNull1.referenceNumber, null);
  assert.equal(paymentNull2.referenceNumber, null);
});

test("Integrity - Progressive Partial Invoicing Decoupled From Order Fulfilment", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const customer = await createCustomer(user.id, org.id, {
    name: `Partial Invoice Customer ${Date.now()}`,
  });

  // Create Order for 10 units @ ₹1,000 = ₹10,000
  const order = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Industrial Sensor Hub",
        hsnSacCode: "8471",
        quantity: 10,
        unitPrice: 1000,
        gstRate: 0,
      },
    ],
  });

  assert.equal(order.invoicingStatus, "UNINVOICED");
  assert.equal(order.status, "DRAFT");

  // 1. Partial Invoice for 4 units
  const invoice1 = await createInvoice(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderId: order.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Industrial Sensor Hub",
        hsnSacCode: "8471",
        quantity: 4,
        unitPrice: 1000,
        gstRate: 0,
      },
    ],
  });
  assert.equal(invoice1.grandTotal, 4000);

  // Verify order invoicingStatus is PARTIALLY_INVOICED and fulfilment status is STILL DRAFT
  let refreshedOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true },
  });
  assert.equal(refreshedOrder?.invoicingStatus, "PARTIALLY_INVOICED");
  assert.equal(refreshedOrder?.status, "DRAFT", "Fulfilment status must NOT be marked COMPLETED by billing");
  assert.equal(refreshedOrder?.items[0].invoicedQuantity, 4);

  // 2. Final Invoice for remaining 6 units
  const invoice2 = await createInvoice(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderId: order.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Industrial Sensor Hub",
        hsnSacCode: "8471",
        quantity: 6,
        unitPrice: 1000,
        gstRate: 0,
      },
    ],
  });
  assert.equal(invoice2.grandTotal, 6000);

  // Verify order invoicingStatus is FULLY_INVOICED and fulfilment status remains DRAFT
  refreshedOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true },
  });
  assert.equal(refreshedOrder?.invoicingStatus, "FULLY_INVOICED");
  assert.equal(refreshedOrder?.status, "DRAFT", "Fulfilment status remains independent of billing");
  assert.equal(refreshedOrder?.items[0].invoicedQuantity, 10);
});

test("Integrity - Over-Invoicing Against Order is Prevented", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const customer = await createCustomer(user.id, org.id, {
    name: `Over-Invoice Customer ${Date.now()}`,
  });

  const order = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Calibrated Pressure Valve",
        hsnSacCode: "8481",
        quantity: 5,
        unitPrice: 2000,
        gstRate: 0,
      },
    ],
  });

  // Attempt to invoice 6 units when order only has 5
  await assert.rejects(
    async () => {
      await createInvoice(user.id, org.id, {
        type: "SALES",
        customerId: customer.id,
        orderId: order.id,
        invoiceDate: new Date(),
        dueDate: new Date(),
        placeOfSupply: "24",
        items: [
          {
            description: "Calibrated Pressure Valve",
            hsnSacCode: "8481",
            quantity: 6,
            unitPrice: 2000,
            gstRate: 0,
          },
        ],
      });
    },
    {
      name: "Error",
      message: /OVER_INVOICING/,
    },
    "Attempting to invoice more than order quantity must throw OVER_INVOICING"
  );
});

test("Integrity - Comprehensive Customer Ledger Reconciliation (Partial, Unallocated, Cancelled, Archived, AutoFix)", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const customer = await createCustomer(user.id, org.id, {
    name: `Deep Reconcile Customer ${Date.now()}`,
  });

  // 1. Create Invoice 1: ₹10,000
  const inv1 = await createInvoice(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Cloud Architecture Service",
        hsnSacCode: "998314",
        quantity: 1,
        unitPrice: 10000,
        gstRate: 0,
      },
    ],
  });

  // 2. Create Invoice 2: ₹5,000
  const inv2 = await createInvoice(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Security Penetration Audit",
        hsnSacCode: "998314",
        quantity: 1,
        unitPrice: 5000,
        gstRate: 0,
      },
    ],
  });

  // Total billed = ₹15,000. Customer balance = ₹15,000.

  // 3. Record PARTIAL payment of ₹4,000 on Invoice 1 (Invoice 1 due = ₹6,000)
  await recordPayment(user.id, org.id, {
    type: "INCOMING",
    invoiceId: inv1.id,
    amount: 4000,
    paymentDate: new Date(),
    referenceNumber: `UTR-PART-${Date.now()}`,
  });

  // 4. Record UNALLOCATED advance payment of ₹2,000 (invoiceId: null)
  await recordPayment(user.id, org.id, {
    type: "INCOMING",
    customerId: customer.id,
    amount: 2000,
    paymentDate: new Date(),
    referenceNumber: `UTR-ADV-${Date.now()}`,
  });

  // Expected balance: (6,000 remaining on inv1 + 5,000 on inv2) - 2,000 unallocated = ₹9,000.
  // Note: The ₹4,000 payment was already subtracted from inv1 due. It is NOT deducted again.
  let rep = await reconcileCustomerBalance(user.id, org.id, customer.id, false);
  assert.equal(rep.isReconciled, true);
  assert.equal(rep.discrepancy, 0);
  assert.equal(rep.expectedBalance, 9000);
  assert.equal(rep.cachedBalance, 9000);
  assert.equal(rep.details.outstandingInvoicesCount, 2);
  assert.equal(rep.details.outstandingInvoicesSum, 11000);
  assert.equal(rep.details.unallocatedPaymentsCount, 1);
  assert.equal(rep.details.unallocatedPaymentsSum, 2000);

  // 5. Test CANCELLED Invoice treatment:
  // Cancel Invoice 2 (₹5,000)
  await prisma.invoice.update({
    where: { id: inv2.id },
    data: { status: "CANCELLED" },
  });

  // Now outstanding invoices sum should only include inv1 (due ₹6,000).
  // Expected balance: 6,000 - 2,000 = ₹4,000.
  rep = await reconcileCustomerBalance(user.id, org.id, customer.id, false);
  assert.equal(rep.isReconciled, false, "Discrepancy must be flagged because cached balance still includes cancelled invoice");
  assert.equal(rep.expectedBalance, 4000);
  assert.equal(rep.details.outstandingInvoicesCount, 1);
  assert.equal(rep.details.outstandingInvoicesSum, 6000);

  // 6. Test autoFix transactional correction & audit logging
  const initialAuditCount = await prisma.auditLog.count({
    where: { entity: "CUSTOMER", entityId: customer.id },
  });

  rep = await reconcileCustomerBalance(user.id, org.id, customer.id, true);
  assert.equal(rep.fixed, true);
  assert.equal(rep.expectedBalance, 4000);

  // Verify DB record is updated
  const refreshedCust = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.equal(refreshedCust?.balance, 4000);

  // Verify AuditLog was recorded atomically
  const postAuditCount = await prisma.auditLog.count({
    where: { entity: "CUSTOMER", entityId: customer.id },
  });
  assert.equal(postAuditCount, initialAuditCount + 1, "autoFix must generate an immutable audit log");

  const latestAudit = await prisma.auditLog.findFirst({
    where: { entity: "CUSTOMER", entityId: customer.id },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(latestAudit?.action, "UPDATE");
  assert.match(latestAudit?.newValues || "", /BALANCE_RECONCILED/);

  // 7. Test ARCHIVED record reconciliation
  await archiveCustomer(user.id, org.id, customer.id);
  const archivedCust = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.equal(archivedCust?.isArchived, true);

  // Reconcile must still work accurately on archived customers
  const archivedRep = await reconcileCustomerBalance(user.id, org.id, customer.id, false);
  assert.equal(archivedRep.isReconciled, true);
  assert.equal(archivedRep.expectedBalance, 4000);
});

test("Integrity - Comprehensive Vendor Ledger Reconciliation (Partial, Unallocated, Cancelled, Archived, AutoFix)", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const vendor = await createVendor(user.id, org.id, {
    name: `Deep Reconcile Vendor ${Date.now()}`,
  });

  // 1. Create Purchase Bill 1: ₹20,000
  const bill1 = await createInvoice(user.id, org.id, {
    type: "PURCHASE",
    vendorId: vendor.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Server Hardware Procurement",
        hsnSacCode: "8471",
        quantity: 1,
        unitPrice: 20000,
        gstRate: 0,
      },
    ],
  });

  // 2. Partial outgoing payment of ₹8,000 on Bill 1 (due ₹12,000)
  await recordPayment(user.id, org.id, {
    type: "OUTGOING",
    invoiceId: bill1.id,
    amount: 8000,
    paymentDate: new Date(),
    referenceNumber: `UTR-VEND-PART-${Date.now()}`,
  });

  // 3. Unallocated advance payment to vendor of ₹3,000
  await recordPayment(user.id, org.id, {
    type: "OUTGOING",
    vendorId: vendor.id,
    amount: 3000,
    paymentDate: new Date(),
    referenceNumber: `UTR-VEND-ADV-${Date.now()}`,
  });

  // Expected balance: 12,000 - 3,000 = ₹9,000
  let rep = await reconcileVendorBalance(user.id, org.id, vendor.id, false);
  assert.equal(rep.isReconciled, true);
  assert.equal(rep.expectedBalance, 9000);
  assert.equal(rep.cachedBalance, 9000);

  // 4. Simulate corruption / drift
  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { balance: 55555 },
  });

  rep = await reconcileVendorBalance(user.id, org.id, vendor.id, false);
  assert.equal(rep.isReconciled, false);
  assert.equal(rep.discrepancy, 46555);

  // 5. autoFix with audit logging
  rep = await reconcileVendorBalance(user.id, org.id, vendor.id, true);
  assert.equal(rep.fixed, true);
  assert.equal(rep.expectedBalance, 9000);

  const refreshedVend = await prisma.vendor.findUnique({ where: { id: vendor.id } });
  assert.equal(refreshedVend?.balance, 9000);

  const vendorAudit = await prisma.auditLog.findFirst({
    where: { entity: "VENDOR", entityId: vendor.id },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(vendorAudit?.action, "UPDATE");
  assert.match(vendorAudit?.newValues || "", /BALANCE_RECONCILED/);

  // 6. Archived vendor reconciliation
  await archiveVendor(user.id, org.id, vendor.id);
  const archivedRep = await reconcileVendorBalance(user.id, org.id, vendor.id, false);
  assert.equal(archivedRep.isReconciled, true);
  assert.equal(archivedRep.expectedBalance, 9000);
});

test("Integrity - Transaction Rollback Upon Failure Leaves Zero Orphan Records", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const customer = await createCustomer(user.id, org.id, {
    name: `Rollback Customer ${Date.now()}`,
  });

  const invoice = await createInvoice(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Atomic Safety Unit",
        hsnSacCode: "8471",
        quantity: 1,
        unitPrice: 5000,
        gstRate: 0,
      },
    ],
  });

  const initialPaymentsCount = await prisma.payment.count({ where: { invoiceId: invoice.id } });
  assert.equal(initialPaymentsCount, 0);

  // Attempt payment that violates balance constraint (₹6,000 > ₹5,000)
  await assert.rejects(
    async () => {
      await recordPayment(user.id, org.id, {
        type: "INCOMING",
        invoiceId: invoice.id,
        amount: 6000,
        paymentDate: new Date(),
      });
    },
    {
      name: "Error",
      message: /PAYMENT_EXCEEDS_BALANCE/,
    }
  );

  // Verify full rollback: 0 payments created, invoice amountPaid unchanged, customer balance unchanged
  const postFailPayments = await prisma.payment.count({ where: { invoiceId: invoice.id } });
  assert.equal(postFailPayments, 0, "No payment record must be created after rollback");

  const refreshedInv = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  assert.equal(refreshedInv?.amountPaid, 0);

  const refreshedCust = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.equal(refreshedCust?.balance, 5000);
});

test("Integrity - Financial Calculations Exclude GST from Revenue and Prevent Outflow Double-Counting", async () => {
  const user = await prisma.user.findUnique({ where: { email: "jenil@theexpanse.local" } });
  const org = await prisma.organization.findUnique({ where: { slug: "expanse-tech" } });
  assert.ok(user && org);

  const customer = await createCustomer(user.id, org.id, {
    name: `Tax Revenue Customer ${Date.now()}`,
    stateCode: "24",
  });

  // Invoice: Subtotal ₹10,000 @ 18% GST -> Total Tax ₹1,800, Grand Total ₹11,800
  await createInvoice(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Turnover Assessment Item",
        hsnSacCode: "998314",
        quantity: 1,
        unitPrice: 10000,
        gstRate: 18,
      },
    ],
  });

  const metrics = await getBusinessMetrics(org.id);

  // Revenue must strictly exclude GST
  assert.ok(typeof metrics.metrics.totalRevenue === "number");
  assert.ok(typeof metrics.metrics.totalGstCollected === "number");
  assert.ok(metrics.metrics.totalGstCollected >= 1800, "GST collected must be tracked as liability");
  assert.ok(typeof metrics.metrics.netGstPayable === "number");
  assert.ok(typeof metrics.metrics.netProfit === "number");
  assert.ok(typeof metrics.metrics.cashInflow === "number");
  assert.ok(typeof metrics.metrics.cashOutflow === "number");
});

test("Integrity - Production Security Guard: Demo Authentication is IMPOSSIBLE in Production", async () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = env.NODE_ENV;
  const originalVercel = env.VERCEL;

  try {
    env.NODE_ENV = "production";
    delete env.VERCEL;

    // 1. Must reject unconditionally in production
    await assert.rejects(
      async () => {
        await getAuthenticatedUser();
      },
      {
        name: "Error",
        message: /AUTHENTICATION_REQUIRED/,
      }
    );

    // 2. Reject even if any environment variable override is attempted
    env.ALLOW_DEV_DEMO_AUTH = "true";
    await assert.rejects(
      async () => {
        await getAuthenticatedUser();
      },
      {
        name: "Error",
        message: /AUTHENTICATION_REQUIRED/,
      }
    );

    // 3. Reject if VERCEL="1" environment is simulated
    env.NODE_ENV = "development";
    env.VERCEL = "1";
    await assert.rejects(
      async () => {
        await getAuthenticatedUser();
      },
      {
        name: "Error",
        message: /AUTHENTICATION_REQUIRED/,
      }
    );
  } finally {
    env.NODE_ENV = originalNodeEnv;
    delete env.ALLOW_DEV_DEMO_AUTH;
    if (originalVercel !== undefined) {
      env.VERCEL = originalVercel;
    } else {
      delete env.VERCEL;
    }
  }
});

