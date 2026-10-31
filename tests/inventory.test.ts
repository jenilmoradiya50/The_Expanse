import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  createWarehouse,
  getWarehouses,
  archiveWarehouse,
  createStockLocation,
  getStockLocations,
  archiveStockLocation,
  recordStockMovement,
  getStockBalances,
  getStockMovements,
  getProductStockOverview,
} from "../src/lib/inventory";
import { createProduct } from "../src/lib/business";
import { StockMovementType } from "../src/types";

test("Inventory Core - Test Database Isolation Check", async () => {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";
  assert.ok(
    dbUrl.includes("test.db"),
    `Tests must run against dedicated test.db, but DATABASE_URL was: ${dbUrl}`
  );
});

test("Inventory Core - Warehouse & Stock Location Lifecycle & Uniqueness", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  const org2 = await prisma.organization.findUnique({
    where: { slug: "expanse-logistics" },
  });

  assert.ok(user);
  assert.ok(org1);
  assert.ok(org2);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const whCode = `WH-BOM-${randSuffix}`;

  // 1. Create warehouse in org1
  const warehouse1 = await createWarehouse(user.id, org1.id, {
    name: `Mumbai Distribution Center ${randSuffix}`,
    code: whCode,
    address: "Bhiwandi Logistics Hub, Sector 4",
    contactPhone: "+91 98200 11223",
    contactEmail: "bom-wh@expanse.test",
  });

  assert.ok(warehouse1.id);
  assert.equal(warehouse1.code, whCode);
  assert.equal(warehouse1.organizationId, org1.id);
  assert.equal(warehouse1.isArchived, false);

  // 2. Reject duplicate warehouse code in same organization
  await assert.rejects(
    async () => {
      await createWarehouse(user.id, org1.id, {
        name: "Duplicate Warehouse",
        code: whCode,
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("DUPLICATE_CODE"));
      return true;
    }
  );

  // 3. Same warehouse code in DIFFERENT organization is permitted (tenant-scoped)
  const warehouseOrg2 = await createWarehouse(user.id, org2.id, {
    name: "Org2 Alternate Facility",
    code: whCode,
  });
  assert.ok(warehouseOrg2.id);
  assert.equal(warehouseOrg2.code, whCode);
  assert.equal(warehouseOrg2.organizationId, org2.id);

  // 4. Multi-tenant isolation: org2 cannot query org1's warehouse
  const org2Warehouses = await getWarehouses(user.id, org2.id);
  const leakedWh = org2Warehouses.find((w) => w.id === warehouse1.id);
  assert.equal(leakedWh, undefined, "Organization 2 must not see Organization 1 warehouses");

  // 5. Create stock locations within warehouse1
  const locCode1 = `RACK-A-${randSuffix}`;
  const loc1 = await createStockLocation(user.id, org1.id, {
    warehouseId: warehouse1.id,
    name: "Aisle A Rack 1",
    code: locCode1,
    description: "High-density pallet racking",
  });

  assert.ok(loc1.id);
  assert.equal(loc1.warehouseId, warehouse1.id);
  assert.equal(loc1.code, locCode1);

  // 6. Reject duplicate location code within same warehouse
  await assert.rejects(
    async () => {
      await createStockLocation(user.id, org1.id, {
        warehouseId: warehouse1.id,
        name: "Duplicate Rack",
        code: locCode1,
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("DUPLICATE_CODE"));
      return true;
    }
  );

  // 7. Cross-tenant location creation rejected (attempting to add location to org2's warehouse using org1 credentials)
  await assert.rejects(
    async () => {
      await createStockLocation(user.id, org1.id, {
        warehouseId: warehouseOrg2.id,
        name: "Rogue Location",
        code: `ROGUE-${randSuffix}`,
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("NOT_FOUND"));
      return true;
    }
  );

  // 8. Soft-archive location & warehouse
  const locCode2 = `RACK-B-${randSuffix}`;
  const loc2 = await createStockLocation(user.id, org1.id, {
    warehouseId: warehouse1.id,
    name: "Aisle B Rack 2",
    code: locCode2,
  });

  const archivedLoc = await archiveStockLocation(user.id, org1.id, loc2.id);
  assert.equal(archivedLoc.isArchived, true);

  const activeLocations = await getStockLocations(user.id, org1.id, { warehouseId: warehouse1.id });
  assert.ok(!activeLocations.some((l) => l.id === loc2.id), "Archived location should not appear in active listings");

  const archivedWh = await archiveWarehouse(user.id, org1.id, warehouse1.id);
  assert.equal(archivedWh.isArchived, true);
});

test("Inventory Core - Stock Movement Invariants & Atomic Ledger Balances", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user);
  assert.ok(org1);

  const rand = Math.floor(1000 + Math.random() * 9000);

  // 1. Setup Warehouse & 2 Locations
  const wh = await createWarehouse(user.id, org1.id, {
    name: `Inventory Fulfillment Center ${rand}`,
    code: `FC-${rand}`,
  });

  const locA = await createStockLocation(user.id, org1.id, {
    warehouseId: wh.id,
    name: "Receiving Bay A",
    code: `BAY-A-${rand}`,
  });

  const locB = await createStockLocation(user.id, org1.id, {
    warehouseId: wh.id,
    name: "Storage Shelf B",
    code: `SHL-B-${rand}`,
  });

  // 2. Setup Tracked Product and Non-Tracked Service
  const trackedProduct = await createProduct(user.id, org1.id, {
    name: `Edge Microserver Unit ${rand}`,
    sku: `SKU-SRV-${rand}`,
    type: "PRODUCT",
    unit: "NOS",
    sellingPrice: 45000,
    purchasePrice: 32000,
    hsnSacCode: "84715000",
    gstRate: 18,
    trackInventory: true,
  });

  const serviceItem = await createProduct(user.id, org1.id, {
    name: `Server Installation SLA ${rand}`,
    sku: `SKU-SLA-${rand}`,
    type: "SERVICE",
    unit: "HRS",
    sellingPrice: 5000,
    purchasePrice: 0,
    hsnSacCode: "998313",
    gstRate: 18,
    trackInventory: false,
  });

  // 3. Reject movement on non-inventory product
  await assert.rejects(
    async () => {
      await recordStockMovement(user.id, org1.id, {
        productId: serviceItem.id,
        type: StockMovementType.INCOMING,
        toLocationId: locA.id,
        quantity: 10,
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("NON_INVENTORY_PRODUCT"));
      return true;
    }
  );

  // 4. Reject invalid inputs for INCOMING (e.g. quantity <= 0 or missing destination)
  await assert.rejects(
    async () => {
      await recordStockMovement(user.id, org1.id, {
        productId: trackedProduct.id,
        type: StockMovementType.INCOMING,
        toLocationId: locA.id,
        quantity: -5,
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("INVALID_QUANTITY"));
      return true;
    }
  );

  // 5. INCOMING: Receive 100 units into locA
  const incomingMovement = await recordStockMovement(user.id, org1.id, {
    productId: trackedProduct.id,
    type: StockMovementType.INCOMING,
    toLocationId: locA.id,
    quantity: 100,
    referenceNumber: `PO-REC-${rand}`,
    reason: "Initial manufacturer batch delivery",
  });

  assert.ok(incomingMovement.movementNumber.startsWith("MOV-"));
  assert.equal(incomingMovement.type, "INCOMING");
  assert.equal(incomingMovement.quantity, 100);
  assert.equal(incomingMovement.toLocationId, locA.id);

  // Verify stock balance at locA
  const balancesAfterIncoming = await getStockBalances(user.id, org1.id, {
    productId: trackedProduct.id,
  });
  const balanceA = balancesAfterIncoming.find((b) => b.locationId === locA.id);
  assert.equal(balanceA?.quantity, 100);

  // 6. OUTGOING: Insufficient stock protection
  // Attempt to issue 150 units from locA (available is 100) -> must throw
  await assert.rejects(
    async () => {
      await recordStockMovement(user.id, org1.id, {
        productId: trackedProduct.id,
        type: StockMovementType.OUTGOING,
        fromLocationId: locA.id,
        quantity: 150,
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("INSUFFICIENT_STOCK"));
      return true;
    }
  );

  // Verify balance at locA remained completely unchanged at 100
  const balanceAfterRejected = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org1.id,
        productId: trackedProduct.id,
        locationId: locA.id,
      },
    },
  });
  assert.equal(balanceAfterRejected?.quantity, 100);

  // 7. OUTGOING: Valid issue of 30 units from locA
  const outgoingMovement = await recordStockMovement(user.id, org1.id, {
    productId: trackedProduct.id,
    type: StockMovementType.OUTGOING,
    fromLocationId: locA.id,
    quantity: 30,
    referenceNumber: `DC-DISP-${rand}`,
    reason: "Dispatched to client data center",
  });

  assert.equal(outgoingMovement.quantity, 30);
  assert.equal(outgoingMovement.fromLocationId, locA.id);

  const balanceAfterIssue = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org1.id,
        productId: trackedProduct.id,
        locationId: locA.id,
      },
    },
  });
  assert.equal(balanceAfterIssue?.quantity, 70); // 100 - 30 = 70

  // 8. TRANSFER: Move 40 units from locA to locB
  // Attempt invalid transfer where source === destination -> must throw
  await assert.rejects(
    async () => {
      await recordStockMovement(user.id, org1.id, {
        productId: trackedProduct.id,
        type: StockMovementType.TRANSFER,
        fromLocationId: locA.id,
        toLocationId: locA.id,
        quantity: 10,
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("Source and destination locations must be distinct"));
      return true;
    }
  );

  // Valid transfer of 40 units
  const transferMovement = await recordStockMovement(user.id, org1.id, {
    productId: trackedProduct.id,
    type: StockMovementType.TRANSFER,
    fromLocationId: locA.id,
    toLocationId: locB.id,
    quantity: 40,
    referenceNumber: `TRF-INT-${rand}`,
    reason: "Replenish forward picking shelf",
  });

  assert.equal(transferMovement.type, "TRANSFER");
  assert.equal(transferMovement.fromLocationId, locA.id);
  assert.equal(transferMovement.toLocationId, locB.id);

  const [balAAfterTrf, balBAfterTrf] = await Promise.all([
    prisma.stockBalance.findUnique({
      where: {
        organizationId_productId_locationId: {
          organizationId: org1.id,
          productId: trackedProduct.id,
          locationId: locA.id,
        },
      },
    }),
    prisma.stockBalance.findUnique({
      where: {
        organizationId_productId_locationId: {
          organizationId: org1.id,
          productId: trackedProduct.id,
          locationId: locB.id,
        },
      },
    }),
  ]);

  assert.equal(balAAfterTrf?.quantity, 30); // 70 - 40 = 30
  assert.equal(balBAfterTrf?.quantity, 40); // 0 + 40 = 40

  // Total stock across locations should equal 70
  const overviews = await getProductStockOverview(user.id, org1.id);
  const prodOverview = overviews.find((o) => o.id === trackedProduct.id);
  assert.ok(prodOverview, "Product should appear in stock overview");
  assert.equal(prodOverview.totalStock, 70);
  assert.equal(prodOverview.valuation, 70 * 32000); // 70 * 32000 = 2,240,000

  // 9. ADJUSTMENT: Reconciliation of physical count
  // Physical count at locB finds 43 units (+3 adjustment)
  const adjMovement = await recordStockMovement(user.id, org1.id, {
    productId: trackedProduct.id,
    type: StockMovementType.ADJUSTMENT,
    toLocationId: locB.id,
    targetQuantity: 43,
    reason: "Cycle count audit discrepancy reconciliation",
  });

  assert.equal(adjMovement.type, "ADJUSTMENT");
  assert.equal(adjMovement.quantity, 3);

  const balBAfterAdj = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org1.id,
        productId: trackedProduct.id,
        locationId: locB.id,
      },
    },
  });
  assert.equal(balBAfterAdj?.quantity, 43);

  // Downward adjustment: Damaged units written off (-3 at locA: 30 -> 27)
  const downAdjMovement = await recordStockMovement(user.id, org1.id, {
    productId: trackedProduct.id,
    type: StockMovementType.ADJUSTMENT,
    fromLocationId: locA.id,
    quantity: 3,
    reason: "Damaged in transit written off",
  });

  assert.equal(downAdjMovement.quantity, 3);
  const balAAfterDownAdj = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org1.id,
        productId: trackedProduct.id,
        locationId: locA.id,
      },
    },
  });
  assert.equal(balAAfterDownAdj?.quantity, 27); // 30 - 3 = 27

  // 10. Verify stock movements query history
  const movements = await getStockMovements(user.id, org1.id, {
    productId: trackedProduct.id,
  });
  assert.ok(movements.length >= 4, "Should record at least 4 movements for this product");
});

test("Inventory Core - Concurrent Movements & Oversell Protection", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user);
  assert.ok(org1);

  const rand = Math.floor(1000 + Math.random() * 9000);

  const wh = await createWarehouse(user.id, org1.id, {
    name: `Concurrency WH ${rand}`,
    code: `WH-CON-${rand}`,
  });

  const loc = await createStockLocation(user.id, org1.id, {
    warehouseId: wh.id,
    name: "Concurrency Test Shelf",
    code: `LOC-CON-${rand}`,
  });

  const product = await createProduct(user.id, org1.id, {
    name: `High-Demand SSD ${rand}`,
    sku: `SKU-SSD-${rand}`,
    type: "PRODUCT",
    sellingPrice: 15000,
    purchasePrice: 10000,
    hsnSacCode: "8471",
    gstRate: 18,
    trackInventory: true,
  });

  // Seed with exactly 25 units
  await recordStockMovement(user.id, org1.id, {
    productId: product.id,
    type: StockMovementType.INCOMING,
    toLocationId: loc.id,
    quantity: 25,
  });

  // Attempt 5 concurrent outgoing movements of 10 units each
  // Only 2 should succeed (2 * 10 = 20 <= 25), 3 must fail due to INSUFFICIENT_STOCK
  const results = await Promise.allSettled([
    recordStockMovement(user.id, org1.id, {
      productId: product.id,
      type: StockMovementType.OUTGOING,
      fromLocationId: loc.id,
      quantity: 10,
      referenceNumber: "CONC-1",
    }),
    recordStockMovement(user.id, org1.id, {
      productId: product.id,
      type: StockMovementType.OUTGOING,
      fromLocationId: loc.id,
      quantity: 10,
      referenceNumber: "CONC-2",
    }),
    recordStockMovement(user.id, org1.id, {
      productId: product.id,
      type: StockMovementType.OUTGOING,
      fromLocationId: loc.id,
      quantity: 10,
      referenceNumber: "CONC-3",
    }),
    recordStockMovement(user.id, org1.id, {
      productId: product.id,
      type: StockMovementType.OUTGOING,
      fromLocationId: loc.id,
      quantity: 10,
      referenceNumber: "CONC-4",
    }),
    recordStockMovement(user.id, org1.id, {
      productId: product.id,
      type: StockMovementType.OUTGOING,
      fromLocationId: loc.id,
      quantity: 10,
      referenceNumber: "CONC-5",
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 2, "Exactly 2 concurrent 10-unit deductions should succeed");
  assert.equal(rejected.length, 3, "Exactly 3 concurrent deductions must be rejected due to insufficient stock");

  // Verify final stock is exactly 5 and never negative
  const finalBalance = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org1.id,
        productId: product.id,
        locationId: loc.id,
      },
    },
  });
  assert.equal(finalBalance?.quantity, 5);
});

test("Inventory Core - Immutable Audit Logging Trail", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user);
  assert.ok(org1);

  const rand = Math.floor(1000 + Math.random() * 9000);

  const wh = await createWarehouse(user.id, org1.id, {
    name: `Audit Log Warehouse ${rand}`,
    code: `WH-AUD-${rand}`,
  });

  const loc = await createStockLocation(user.id, org1.id, {
    warehouseId: wh.id,
    name: "Audit Location",
    code: `LOC-AUD-${rand}`,
  });

  const product = await createProduct(user.id, org1.id, {
    name: `Audit Check Product ${rand}`,
    sku: `SKU-AUD-${rand}`,
    type: "PRODUCT",
    sellingPrice: 1000,
    hsnSacCode: "8471",
    gstRate: 18,
    trackInventory: true,
  });

  const movement = await recordStockMovement(user.id, org1.id, {
    productId: product.id,
    type: StockMovementType.INCOMING,
    toLocationId: loc.id,
    quantity: 15,
    referenceNumber: `AUD-REF-${rand}`,
    reason: "Audit test receipt",
  });

  // Verify audit logs were written for Warehouse, Location, and Stock Movement
  const [whAudit, locAudit, movAudit] = await Promise.all([
    prisma.auditLog.findFirst({
      where: { organizationId: org1.id, entity: "WAREHOUSE", entityId: wh.id },
    }),
    prisma.auditLog.findFirst({
      where: { organizationId: org1.id, entity: "STOCK_LOCATION", entityId: loc.id },
    }),
    prisma.auditLog.findFirst({
      where: { organizationId: org1.id, entity: "STOCK_MOVEMENT", entityId: movement.id },
    }),
  ]);

  assert.ok(whAudit, "Warehouse creation must record an audit log");
  assert.ok(locAudit, "Stock location creation must record an audit log");
  assert.ok(movAudit, "Stock movement must record an audit log");
  assert.equal(movAudit?.action, "CREATE");
  assert.equal(movAudit?.userId, user.id);
});
