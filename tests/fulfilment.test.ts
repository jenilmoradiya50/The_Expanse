import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  createWarehouse,
  createStockLocation,
  recordStockMovement,
  fulfilSalesOrder,
  receivePurchaseOrder,
  getOrderFulfilments,
  getOrderFulfilmentDetails,
} from "../src/lib/inventory";
import {
  createProduct,
  createCustomer,
  createVendor,
  createOrder,
  createInvoice,
} from "../src/lib/business";
import { StockMovementType } from "../src/types";

test("Fulfilment - Sales Order Full & Progressive Partial Fulfilment", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  // Setup Warehouse & Location
  const warehouse = await createWarehouse(user.id, org.id, {
    name: `Dispatch Hub ${randSuffix}`,
    code: `WH-DSP-${randSuffix}`,
  });
  const location = await createStockLocation(user.id, org.id, {
    warehouseId: warehouse.id,
    name: "Main Dispatch Bay",
    code: `BAY-${randSuffix}`,
  });

  // Setup Tracked Product
  const product = await createProduct(user.id, org.id, {
    name: `Industrial Servo Drive ${randSuffix}`,
    sku: `SERVO-${randSuffix}`,
    type: "PRODUCT",
    unit: "PCS",
    purchasePrice: 5000,
    sellingPrice: 8500,
    hsnSacCode: "8479",
    gstRate: 18,
    trackInventory: true,
  });

  // Stock the warehouse location with 100 units
  await recordStockMovement(user.id, org.id, {
    productId: product.id,
    type: StockMovementType.INCOMING,
    toLocationId: location.id,
    quantity: 100,
    reason: "Initial warehouse stocking",
  });

  // Verify initial stock balance
  const initialBalance = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(initialBalance?.quantity, 100);

  // Create Customer & Sales Order for 20 units
  const customer = await createCustomer(user.id, org.id, {
    name: `Precision Robotics ${randSuffix}`,
    stateCode: "24",
  });

  const order = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Industrial Servo Drive ${randSuffix}`,
        hsnSacCode: "8479",
        quantity: 20,
        unitPrice: 8500,
        gstRate: 18,
      },
    ],
  });

  assert.equal(order.fulfilmentStatus, "UNFULFILLED");
  assert.equal(order.invoicingStatus, "UNINVOICED");
  const orderItemId = order.items[0].id;

  // 1. First Partial Fulfilment: Dispatch 8 units
  const res1 = await fulfilSalesOrder(user.id, org.id, {
    orderId: order.id,
    items: [
      {
        orderItemId,
        locationId: location.id,
        quantity: 8,
      },
    ],
    notes: "Partial shipment tranche 1",
  });

  assert.equal(res1.alreadyProcessed, false);
  assert.ok(res1.fulfilment.fulfilmentNumber.startsWith("FUL-"));
  assert.equal(res1.fulfilment.type, "SALES_FULFILMENT");
  assert.ok(res1.order);
  assert.equal(res1.order.fulfilmentStatus, "PARTIALLY_FULFILLED");

  // Check location stock balance decremented by 8
  const balanceAfterTranche1 = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(balanceAfterTranche1?.quantity, 92);

  // Check OrderItem fulfilledQuantity
  const itemAfterTranche1 = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
  });
  assert.equal(itemAfterTranche1?.fulfilledQuantity, 8);

  // Check StockMovement created of type OUTGOING
  const movementTranche1 = await prisma.stockMovement.findFirst({
    where: {
      organizationId: org.id,
      productId: product.id,
      fromLocationId: location.id,
      type: "OUTGOING",
    },
  });
  assert.ok(movementTranche1);
  assert.equal(movementTranche1.quantity, 8);
  assert.ok(movementTranche1.movementNumber.startsWith("MOV-"));

  // 2. Second Fulfilment: Dispatch remaining 12 units
  const res2 = await fulfilSalesOrder(user.id, org.id, {
    orderId: order.id,
    items: [
      {
        orderItemId,
        locationId: location.id,
        quantity: 12,
      },
    ],
    notes: "Final shipment tranche 2",
  });

  assert.ok(res2.order);
  assert.equal(res2.order.fulfilmentStatus, "FULFILLED");

  // Check final location stock balance is 80 (100 - 8 - 12)
  const balanceAfterTranche2 = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(balanceAfterTranche2?.quantity, 80);

  // Check OrderItem fulfilledQuantity is 20
  const itemAfterTranche2 = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
  });
  assert.equal(itemAfterTranche2?.fulfilledQuantity, 20);

  // 3. Test getOrderFulfilments and getOrderFulfilmentDetails
  const history = await getOrderFulfilments(user.id, org.id, order.id);
  assert.equal(history.length, 2);
  assert.equal(history[0].id, res2.fulfilment.id); // Latest first
  assert.equal(history[1].id, res1.fulfilment.id);

  const details = await getOrderFulfilmentDetails(user.id, org.id, order.id);
  assert.equal(details.order.fulfilmentStatus, "FULFILLED");
  assert.equal(details.items[0].remainingQuantity, 0);
  assert.equal(details.items[0].fulfilledQuantity, 20);
});

test("Fulfilment - Over-Fulfilment Rejection & Atomic Guard", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  const warehouse = await createWarehouse(user.id, org.id, {
    name: `Guard WH ${randSuffix}`,
    code: `WH-GD-${randSuffix}`,
  });
  const location = await createStockLocation(user.id, org.id, {
    warehouseId: warehouse.id,
    name: "Bay 1",
    code: `B1-${randSuffix}`,
  });
  const product = await createProduct(user.id, org.id, {
    name: `Titanium Valve ${randSuffix}`,
    sku: `VALVE-${randSuffix}`,
    purchasePrice: 1500,
    sellingPrice: 3000,
    hsnSacCode: "8481",
    gstRate: 18,
    trackInventory: true,
  });

  await recordStockMovement(user.id, org.id, {
    productId: product.id,
    type: StockMovementType.INCOMING,
    toLocationId: location.id,
    quantity: 50,
  });

  const customer = await createCustomer(user.id, org.id, {
    name: `Client Guard ${randSuffix}`,
  });

  const order = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Titanium Valve ${randSuffix}`,
        hsnSacCode: "8481",
        quantity: 10,
        unitPrice: 3000,
        gstRate: 18,
      },
    ],
  });

  // Attempting to fulfil 11 units against order of 10 must fail
  await assert.rejects(
    async () => {
      await fulfilSalesOrder(user.id, org.id, {
        orderId: order.id,
        items: [
          {
            orderItemId: order.items[0].id,
            locationId: location.id,
            quantity: 11,
          },
        ],
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("OVER_FULFILMENT"));
      return true;
    }
  );

  // Verify stock balance remained untouched at 50
  const balance = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(balance?.quantity, 50);

  // Verify order remained UNFULFILLED
  const freshOrder = await prisma.order.findUnique({ where: { id: order.id } });
  assert.equal(freshOrder?.fulfilmentStatus, "UNFULFILLED");
});

test("Fulfilment - Insufficient Stock Rejection & Atomic Rollback", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  const warehouse = await createWarehouse(user.id, org.id, {
    name: `Stock Depleted WH ${randSuffix}`,
    code: `WH-SD-${randSuffix}`,
  });
  const location = await createStockLocation(user.id, org.id, {
    warehouseId: warehouse.id,
    name: "Rack Low",
    code: `RL-${randSuffix}`,
  });
  const product = await createProduct(user.id, org.id, {
    name: `Optic Sensor ${randSuffix}`,
    sku: `OPT-${randSuffix}`,
    purchasePrice: 800,
    sellingPrice: 1500,
    hsnSacCode: "9031",
    gstRate: 18,
    trackInventory: true,
  });

  // Stock only 5 units in warehouse
  await recordStockMovement(user.id, org.id, {
    productId: product.id,
    type: StockMovementType.INCOMING,
    toLocationId: location.id,
    quantity: 5,
  });

  const customer = await createCustomer(user.id, org.id, {
    name: `Optics Client ${randSuffix}`,
  });

  // Order is for 20 units
  const order = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Optic Sensor ${randSuffix}`,
        hsnSacCode: "9031",
        quantity: 20,
        unitPrice: 1500,
        gstRate: 18,
      },
    ],
  });

  // Attempting to fulfil 15 units when location only has 5 must throw INSUFFICIENT_STOCK
  await assert.rejects(
    async () => {
      await fulfilSalesOrder(user.id, org.id, {
        orderId: order.id,
        items: [
          {
            orderItemId: order.items[0].id,
            locationId: location.id,
            quantity: 15,
          },
        ],
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("INSUFFICIENT_STOCK"));
      return true;
    }
  );

  // Balance remains 5
  const balance = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(balance?.quantity, 5);

  // Zero fulfilments created
  const fulfilments = await prisma.orderFulfilment.findMany({
    where: { orderId: order.id },
  });
  assert.equal(fulfilments.length, 0);
});

test("Fulfilment - Service & Non-Inventory Product Handling (Zero Stock Movement)", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  // Create Service product (trackInventory false)
  const serviceProduct = await createProduct(user.id, org.id, {
    name: `Cloud DevOps Retainer ${randSuffix}`,
    type: "SERVICE",
    unit: "HRS",
    sellingPrice: 4000,
    hsnSacCode: "998314",
    gstRate: 18,
    trackInventory: false,
  });

  const customer = await createCustomer(user.id, org.id, {
    name: `Cloud Customer ${randSuffix}`,
  });

  const order = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: serviceProduct.id,
        description: `Cloud DevOps Retainer ${randSuffix}`,
        hsnSacCode: "998314",
        quantity: 10,
        unitPrice: 4000,
        gstRate: 18,
      },
    ],
  });

  // Fulfil service order without locationId
  const res = await fulfilSalesOrder(user.id, org.id, {
    orderId: order.id,
    items: [
      {
        orderItemId: order.items[0].id,
        quantity: 10,
      },
    ],
    notes: "Service hours delivered and signed off",
  });

  assert.ok(res.order);
  assert.equal(res.order.fulfilmentStatus, "FULFILLED");

  // Verify OrderFulfilmentItem has no stockMovement or location
  const fulfilmentItem = await prisma.orderFulfilmentItem.findFirst({
    where: { fulfilmentId: res.fulfilment.id },
  });
  assert.ok(fulfilmentItem);
  assert.equal(fulfilmentItem.locationId, null);
  assert.equal(fulfilmentItem.stockMovementId, null);
  assert.equal(fulfilmentItem.quantity, 10);

  // Verify zero StockMovement rows were created in org for this service
  const movements = await prisma.stockMovement.findMany({
    where: { organizationId: org.id, productId: serviceProduct.id },
  });
  assert.equal(movements.length, 0);
});

test("Fulfilment - Purchase Order Receiving & Inward Stock", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  const warehouse = await createWarehouse(user.id, org.id, {
    name: `Receiving Terminal ${randSuffix}`,
    code: `WH-RCV-${randSuffix}`,
  });
  const location = await createStockLocation(user.id, org.id, {
    warehouseId: warehouse.id,
    name: "Inbound Dock 1",
    code: `IN-D1-${randSuffix}`,
  });
  const product = await createProduct(user.id, org.id, {
    name: `Motherboard X9 ${randSuffix}`,
    sku: `MB-X9-${randSuffix}`,
    purchasePrice: 8000,
    sellingPrice: 12000,
    hsnSacCode: "8473",
    gstRate: 18,
    trackInventory: true,
  });

  const vendor = await createVendor(user.id, org.id, {
    name: `Semiconductor OEM ${randSuffix}`,
  });

  // Create Purchase Order for 50 units
  const po = await createOrder(user.id, org.id, {
    type: "PURCHASE",
    vendorId: vendor.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Motherboard X9 ${randSuffix}`,
        hsnSacCode: "8473",
        quantity: 50,
        unitPrice: 12000,
        gstRate: 18,
      },
    ],
  });

  assert.ok(po.fulfilmentStatus === "UNFULFILLED" || po.fulfilmentStatus === "UNRECEIVED");

  // 1. Partial Receipt: Inward 30 units
  const res1 = await receivePurchaseOrder(user.id, org.id, {
    orderId: po.id,
    items: [
      {
        orderItemId: po.items[0].id,
        locationId: location.id,
        quantity: 30,
      },
    ],
    notes: "First batch inward DC #1021",
  });

  assert.ok(res1.fulfilment.fulfilmentNumber.startsWith("REC-"));
  assert.equal(res1.fulfilment.type, "PURCHASE_RECEIPT");
  assert.ok(res1.order);
  assert.equal(res1.order.fulfilmentStatus, "PARTIALLY_RECEIVED");

  // Stock balance increased to 30
  const balance1 = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(balance1?.quantity, 30);

  // 2. Complete Remaining Receipt: Inward 20 units
  const res2 = await receivePurchaseOrder(user.id, org.id, {
    orderId: po.id,
    items: [
      {
        orderItemId: po.items[0].id,
        locationId: location.id,
        quantity: 20,
      },
    ],
  });

  assert.ok(res2.order);
  assert.equal(res2.order.fulfilmentStatus, "RECEIVED");

  // Stock balance increased to 50
  const balance2 = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(balance2?.quantity, 50);

  const poItem = await prisma.orderItem.findUnique({
    where: { id: po.items[0].id },
  });
  assert.equal(poItem?.receivedQuantity, 50);
});

test("Fulfilment - Purchase Order Over-Receipt Policy Guard", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  const warehouse = await createWarehouse(user.id, org.id, {
    name: `Policy WH ${randSuffix}`,
    code: `WH-POL-${randSuffix}`,
  });
  const location = await createStockLocation(user.id, org.id, {
    warehouseId: warehouse.id,
    name: "Inbound Bay",
    code: `IN-BAY-${randSuffix}`,
  });
  const product = await createProduct(user.id, org.id, {
    name: `Copper Tubing ${randSuffix}`,
    sku: `COPPER-${randSuffix}`,
    purchasePrice: 300,
    sellingPrice: 500,
    hsnSacCode: "7411",
    gstRate: 18,
    trackInventory: true,
  });
  const vendor = await createVendor(user.id, org.id, {
    name: `Metal Supplies ${randSuffix}`,
  });

  const po = await createOrder(user.id, org.id, {
    type: "PURCHASE",
    vendorId: vendor.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Copper Tubing ${randSuffix}`,
        hsnSacCode: "7411",
        quantity: 10,
        unitPrice: 500,
        gstRate: 18,
      },
    ],
  });

  // Attempting to receive 15 units without allowOverReceipt flag must be rejected
  await assert.rejects(
    async () => {
      await receivePurchaseOrder(user.id, org.id, {
        orderId: po.id,
        items: [
          {
            orderItemId: po.items[0].id,
            locationId: location.id,
            quantity: 15,
          },
        ],
        allowOverReceipt: false,
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("OVER_RECEIPT"));
      return true;
    }
  );

  // Receiving 15 units WITH explicit allowOverReceipt: true must succeed
  const res = await receivePurchaseOrder(user.id, org.id, {
    orderId: po.id,
    items: [
      {
        orderItemId: po.items[0].id,
        locationId: location.id,
        quantity: 15,
      },
    ],
    allowOverReceipt: true,
    notes: "Supplier supplied +50% excess approved by procurement",
  });

  assert.ok(res.order);
  assert.equal(res.order.fulfilmentStatus, "RECEIVED");

  // Location balance reflects 15
  const balance = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(balance?.quantity, 15);
});

test("Fulfilment - Decoupling From Invoicing and Financial Balances", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  const warehouse = await createWarehouse(user.id, org.id, {
    name: `Decouple WH ${randSuffix}`,
    code: `WH-DEC-${randSuffix}`,
  });
  const location = await createStockLocation(user.id, org.id, {
    warehouseId: warehouse.id,
    name: "Location D",
    code: `LOC-D-${randSuffix}`,
  });
  const product = await createProduct(user.id, org.id, {
    name: `Decoupled Item ${randSuffix}`,
    sku: `DEC-${randSuffix}`,
    purchasePrice: 600,
    sellingPrice: 1000,
    hsnSacCode: "8471",
    gstRate: 18,
    trackInventory: true,
  });

  await recordStockMovement(user.id, org.id, {
    productId: product.id,
    type: StockMovementType.INCOMING,
    toLocationId: location.id,
    quantity: 50,
  });

  const customer = await createCustomer(user.id, org.id, {
    name: `Decouple Customer ${randSuffix}`,
  });
  const initialCustomerBalance = customer.balance;

  const order = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Decoupled Item ${randSuffix}`,
        hsnSacCode: "8471",
        quantity: 10,
        unitPrice: 1000,
        gstRate: 18,
      },
    ],
  });

  // Fulfil order completely
  await fulfilSalesOrder(user.id, org.id, {
    orderId: order.id,
    items: [
      {
        orderItemId: order.items[0].id,
        locationId: location.id,
        quantity: 10,
      },
    ],
  });

  // Verify invoicingStatus is still UNINVOICED
  const freshOrder = await prisma.order.findUnique({ where: { id: order.id } });
  assert.equal(freshOrder?.fulfilmentStatus, "FULFILLED");
  assert.equal(freshOrder?.invoicingStatus, "UNINVOICED");

  // Customer balance is NOT modified by fulfilment
  const freshCustomer = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.equal(freshCustomer?.balance, initialCustomerBalance);

  // Invoicing happens independently
  const invoice = await createInvoice(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderId: order.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Decoupled Item ${randSuffix}`,
        hsnSacCode: "8471",
        quantity: 10,
        unitPrice: 1000,
        gstRate: 18,
      },
    ],
  });
  assert.ok(invoice.id);

  // Only NOW is invoicing status updated to FULLY_INVOICED
  const invoicedOrder = await prisma.order.findUnique({ where: { id: order.id } });
  assert.equal(invoicedOrder?.invoicingStatus, "FULLY_INVOICED");
  assert.equal(invoicedOrder?.fulfilmentStatus, "FULFILLED");
});

test("Fulfilment - Multi-Tenant Isolation & Cross-Tenant Rejection", async () => {
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

  // Create warehouse and location in org1
  const wh1 = await createWarehouse(user.id, org1.id, {
    name: `Org1 WH ${randSuffix}`,
    code: `WH1-${randSuffix}`,
  });
  const loc1 = await createStockLocation(user.id, org1.id, {
    warehouseId: wh1.id,
    name: "Org1 Loc",
    code: `L1-${randSuffix}`,
  });

  // Create tracked product in org2
  const prod2 = await createProduct(user.id, org2.id, {
    name: `Tracked Prod Org2 ${randSuffix}`,
    sku: `P2-${randSuffix}`,
    purchasePrice: 600,
    sellingPrice: 1000,
    hsnSacCode: "8471",
    gstRate: 18,
    trackInventory: true,
  });

  // Create order in org2
  const customer2 = await createCustomer(user.id, org2.id, {
    name: `Org2 Client ${randSuffix}`,
  });
  const order2 = await createOrder(user.id, org2.id, {
    type: "SALES",
    customerId: customer2.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: prod2.id,
        description: `Tracked item in Org2 ${randSuffix}`,
        hsnSacCode: "8471",
        quantity: 5,
        unitPrice: 1000,
        gstRate: 18,
      },
    ],
  });

  // Attempting to fulfil Org2's order with Org1 context must fail
  await assert.rejects(
    async () => {
      await fulfilSalesOrder(user.id, org1.id, {
        orderId: order2.id,
        items: [
          {
            orderItemId: order2.items[0].id,
            quantity: 5,
          },
        ],
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("NOT_FOUND"));
      return true;
    }
  );

  // Attempting to dispatch from Org1's location while fulfilling in Org2 must fail
  await assert.rejects(
    async () => {
      await fulfilSalesOrder(user.id, org2.id, {
        orderId: order2.id,
        items: [
          {
            orderItemId: order2.items[0].id,
            locationId: loc1.id, // cross-tenant location!
            quantity: 5,
          },
        ],
      });
    },
    (err: Error) => {
      assert.ok(err.message.includes("CROSS_TENANT") || err.message.includes("NOT_FOUND"));
      return true;
    }
  );
});

test("Fulfilment - Idempotency & Duplicate Request Protection", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const idempotencyKey = `IDEM-FUL-${randSuffix}-${Date.now()}`;

  const warehouse = await createWarehouse(user.id, org.id, {
    name: `Idempotency WH ${randSuffix}`,
    code: `WH-IDM-${randSuffix}`,
  });
  const location = await createStockLocation(user.id, org.id, {
    warehouseId: warehouse.id,
    name: "Location Idem",
    code: `LOC-IDM-${randSuffix}`,
  });
  const product = await createProduct(user.id, org.id, {
    name: `Network Bridge ${randSuffix}`,
    sku: `BRG-${randSuffix}`,
    purchasePrice: 1200,
    sellingPrice: 2000,
    hsnSacCode: "8517",
    gstRate: 18,
    trackInventory: true,
  });

  await recordStockMovement(user.id, org.id, {
    productId: product.id,
    type: StockMovementType.INCOMING,
    toLocationId: location.id,
    quantity: 50,
  });

  const customer = await createCustomer(user.id, org.id, {
    name: `Idempotency Customer ${randSuffix}`,
  });

  const order = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Network Bridge ${randSuffix}`,
        hsnSacCode: "8517",
        quantity: 10,
        unitPrice: 2000,
        gstRate: 18,
      },
    ],
  });

  // First Call: succeeds and decrements stock by 5
  const call1 = await fulfilSalesOrder(user.id, org.id, {
    orderId: order.id,
    items: [
      {
        orderItemId: order.items[0].id,
        locationId: location.id,
        quantity: 5,
      },
    ],
    idempotencyKey,
  });

  assert.equal(call1.alreadyProcessed, false);

  // Balance is 45
  const balance1 = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(balance1?.quantity, 45);

  // Second Call with same idempotencyKey returns existing record
  const call2 = await fulfilSalesOrder(user.id, org.id, {
    orderId: order.id,
    items: [
      {
        orderItemId: order.items[0].id,
        locationId: location.id,
        quantity: 5,
      },
    ],
    idempotencyKey,
  });

  assert.equal(call2.alreadyProcessed, true);
  assert.equal(call2.fulfilment.id, call1.fulfilment.id);

  // Balance remains 45 (NOT double-decremented)
  const balance2 = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(balance2?.quantity, 45);
});

test("Fulfilment - Concurrency & Race Condition Protection", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  const warehouse = await createWarehouse(user.id, org.id, {
    name: `Race WH ${randSuffix}`,
    code: `WH-RC-${randSuffix}`,
  });
  const location = await createStockLocation(user.id, org.id, {
    warehouseId: warehouse.id,
    name: "Bay Race",
    code: `BR-${randSuffix}`,
  });
  const product = await createProduct(user.id, org.id, {
    name: `Limited Stock Product ${randSuffix}`,
    sku: `LTD-${randSuffix}`,
    purchasePrice: 3000,
    sellingPrice: 5000,
    hsnSacCode: "8471",
    gstRate: 18,
    trackInventory: true,
  });

  // Stock EXACTLY 10 units
  await recordStockMovement(user.id, org.id, {
    productId: product.id,
    type: StockMovementType.INCOMING,
    toLocationId: location.id,
    quantity: 10,
  });

  const customer = await createCustomer(user.id, org.id, {
    name: `Race Customer ${randSuffix}`,
  });

  // Two separate orders each wanting 8 units
  const orderA = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Limited Stock Product ${randSuffix}`,
        hsnSacCode: "8471",
        quantity: 8,
        unitPrice: 5000,
        gstRate: 18,
      },
    ],
  });

  const orderB = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        productId: product.id,
        description: `Limited Stock Product ${randSuffix}`,
        hsnSacCode: "8471",
        quantity: 8,
        unitPrice: 5000,
        gstRate: 18,
      },
    ],
  });

  // Attempt to fulfil both simultaneously (8 + 8 = 16 > 10 available)
  const results = await Promise.allSettled([
    fulfilSalesOrder(user.id, org.id, {
      orderId: orderA.id,
      items: [{ orderItemId: orderA.items[0].id, locationId: location.id, quantity: 8 }],
    }),
    fulfilSalesOrder(user.id, org.id, {
      orderId: orderB.id,
      items: [{ orderItemId: orderB.items[0].id, locationId: location.id, quantity: 8 }],
    }),
  ]);

  const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
  const rejectedCount = results.filter((r) => r.status === "rejected").length;

  assert.equal(fulfilledCount, 1, "Exactly one concurrent fulfilment must succeed");
  assert.equal(rejectedCount, 1, "The second concurrent fulfilment must be rejected due to insufficient stock");

  // Stock balance must be exactly 2 (10 - 8), never negative!
  const finalBalance = await prisma.stockBalance.findUnique({
    where: {
      organizationId_productId_locationId: {
        organizationId: org.id,
        productId: product.id,
        locationId: location.id,
      },
    },
  });
  assert.equal(finalBalance?.quantity, 2);
});

test("Fulfilment - Audit Trail Completeness", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(user);
  assert.ok(org);

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  const customer = await createCustomer(user.id, org.id, {
    name: `Audit Customer ${randSuffix}`,
  });

  const order = await createOrder(user.id, org.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: `Consulting Unit ${randSuffix}`,
        hsnSacCode: "9983",
        quantity: 1,
        unitPrice: 10000,
        gstRate: 18,
      },
    ],
  });

  const res = await fulfilSalesOrder(user.id, org.id, {
    orderId: order.id,
    items: [
      {
        orderItemId: order.items[0].id,
        quantity: 1,
      },
    ],
    notes: "Audit test dispatch",
  });

  // Verify audit log for ORDER_FULFILMENT exists
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      organizationId: org.id,
      entity: "ORDER_FULFILMENT",
      entityId: res.fulfilment.id,
    },
  });

  assert.ok(auditLog);
  assert.equal(auditLog.action, "CREATE");
  assert.equal(auditLog.userId, user.id);
});
