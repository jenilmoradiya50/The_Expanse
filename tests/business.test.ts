import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  createCustomer,
  getCustomers,
  updateCustomer,
  archiveCustomer,
  createVendor,
  getVendors,
  archiveVendor,
  createProduct,
  getProducts,
  archiveProduct,
  createOrder,
  getOrders,
  createInvoice,
  getInvoices,
  recordPayment,
  getPayments,
} from "../src/lib/business";
import { Role } from "../src/types";

test("Business - Customer Management & Duplicate GSTIN Isolation", async () => {
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

  const rand4 = Math.floor(1000 + Math.random() * 9000);
  const testGstin = `24TESTA${rand4}A1Z5`;

  // 1. Create a customer in org1
  const customer1 = await createCustomer(user.id, org1.id, {
    name: "Acme Enterprises Corp",
    email: "billing@acme-corp.test",
    phone: "9876543210",
    gstin: testGstin,
    stateCode: "24",
    billingAddress: "401 Corporate Park, Ahmedabad, Gujarat",
    paymentTerms: "NET_30",
  });

  assert.ok(customer1.id);
  assert.equal(customer1.name, "Acme Enterprises Corp");
  assert.equal(customer1.gstin, testGstin);
  assert.equal(customer1.balance, 0);

  // 2. Attempt duplicate GSTIN in the same organization -> must throw
  await assert.rejects(
    async () => {
      await createCustomer(user.id, org1.id, {
        name: "Acme Duplicate Ltd",
        gstin: testGstin,
      });
    },
    {
      name: "Error",
      message: /DUPLICATE_GSTIN/,
    },
    "Must reject duplicate customer GSTIN within the same organization"
  );

  // 3. Create customer with the SAME GSTIN in org2 -> must succeed (tenant isolation)
  const customerOrg2 = await createCustomer(user.id, org2.id, {
    name: "Acme Logistics Branch",
    gstin: testGstin,
  });
  assert.ok(customerOrg2.id);
  assert.equal(customerOrg2.organizationId, org2.id);

  // 4. Update customer
  const updated = await updateCustomer(user.id, org1.id, customer1.id, {
    phone: "9123456780",
    billingAddress: "502 New Corporate Tower, Ahmedabad",
  });
  assert.equal(updated.phone, "9123456780");
  assert.equal(updated.billingAddress, "502 New Corporate Tower, Ahmedabad");

  // 5. Query customers
  const activeCustomers = await getCustomers(user.id, org1.id, { search: "Acme" });
  assert.ok(activeCustomers.some((c) => c.id === customer1.id));

  // 6. Archive customer
  await archiveCustomer(user.id, org1.id, customer1.id);

  const activeAfterArchive = await getCustomers(user.id, org1.id);
  assert.ok(!activeAfterArchive.some((c) => c.id === customer1.id), "Archived customer excluded by default");

  const includingArchived = await getCustomers(user.id, org1.id, { includeArchived: true });
  assert.ok(includingArchived.some((c) => c.id === customer1.id), "Archived customer included with flag");
});

test("Business - Supplier (Vendor) Management & Duplicate Protection", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user);
  assert.ok(org1);

  const randVendor = Math.floor(1000 + Math.random() * 9000);
  const vendorGstin = `27VENDB${randVendor}B1Z4`;

  // 1. Create Vendor
  const vendor = await createVendor(user.id, org1.id, {
    name: "Apex Server Hardware Ltd",
    email: "sales@apex-servers.test",
    phone: "9988776655",
    gstin: vendorGstin,
    stateCode: "27", // Maharashtra
    bankName: "HDFC Bank",
    bankAccountNumber: "50100223344556",
    paymentTerms: "NET_15",
  });

  assert.ok(vendor.id);
  assert.equal(vendor.name, "Apex Server Hardware Ltd");
  assert.equal(vendor.gstin, vendorGstin);
  assert.equal(vendor.balance, 0);

  // 2. Reject duplicate GSTIN in same org
  await assert.rejects(
    async () => {
      await createVendor(user.id, org1.id, {
        name: "Apex Duplicate",
        gstin: vendorGstin,
      });
    },
    {
      name: "Error",
      message: /DUPLICATE_GSTIN/,
    },
    "Must reject duplicate vendor GSTIN in same organization"
  );

  // 3. Archive Vendor
  await archiveVendor(user.id, org1.id, vendor.id);
  const activeVendors = await getVendors(user.id, org1.id);
  assert.ok(!activeVendors.some((v) => v.id === vendor.id), "Archived vendor excluded");
});

test("Business - Products & Services Catalog & SKU Uniqueness", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user);
  assert.ok(org1);

  const uniqueSku = `SRV-NODE-${Date.now().toString().slice(-4)}`;

  // 1. Create Product
  const product = await createProduct(user.id, org1.id, {
    name: "High-Performance Edge Gateway",
    sku: uniqueSku,
    description: "Industrial IoT edge gateway device",
    type: "PRODUCT",
    unit: "NOS",
    sellingPrice: 15000,
    purchasePrice: 11000,
    hsnSacCode: "8471",
    gstRate: 18,
  });

  assert.ok(product.id);
  assert.equal(product.sku, uniqueSku);
  assert.equal(product.sellingPrice, 15000);
  assert.equal(product.gstRate, 18);

  // 2. Rejection of duplicate SKU in same org
  await assert.rejects(
    async () => {
      await createProduct(user.id, org1.id, {
        name: "Conflicting Gateway",
        sku: uniqueSku,
        sellingPrice: 16000,
        hsnSacCode: "8471",
        gstRate: 18,
      });
    },
    {
      name: "Error",
      message: /DUPLICATE_SKU/,
    },
    "Must reject duplicate SKU in same organization"
  );

  // 3. Create Service
  const service = await createProduct(user.id, org1.id, {
    name: "Annual Cloud Maintenance",
    type: "SERVICE",
    unit: "HRS",
    sellingPrice: 3500,
    hsnSacCode: "998313",
    gstRate: 18,
  });
  assert.ok(service.id);
  assert.equal(service.type, "SERVICE");

  // 4. Archive product
  await archiveProduct(user.id, org1.id, product.id);
  const activeProducts = await getProducts(user.id, org1.id);
  assert.ok(!activeProducts.some((p) => p.id === product.id));
});

test("Business - Sales Orders with Decimal Tax Calculations", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user);
  assert.ok(org1);

  // Create an active customer
  const customer = await createCustomer(user.id, org1.id, {
    name: `Order Client ${Date.now()}`,
    stateCode: "24", // Gujarat (Intra-state with expanse-tech)
  });

  // Create intra-state sales order:
  // Item 1: Qty 2 @ 10,000, Discount 1,000 = Taxable 19,000 @ 18% GST -> CGST 9% (1,710), SGST 9% (1,710) -> Item total 22,420
  // Item 2: Qty 1 @ 5,000, Discount 0 = Taxable 5,000 @ 12% GST -> CGST 6% (300), SGST 6% (300) -> Item total 5,600
  // Grand total = 22,420 + 5,600 = 28,020
  const order = await createOrder(user.id, org1.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24", // Intra-state
    items: [
      {
        description: "Server Blade A",
        hsnSacCode: "8471",
        quantity: 2,
        unitPrice: 10000,
        discount: 1000,
        gstRate: 18,
      },
      {
        description: "Network Switch B",
        hsnSacCode: "8517",
        quantity: 1,
        unitPrice: 5000,
        discount: 0,
        gstRate: 12,
      },
    ],
  });

  assert.ok(order.id);
  assert.match(order.orderNumber, /^SO-\d{4}-\d{4}$/);
  assert.equal(order.isInterState, false);
  assert.equal(order.subtotal, 24000); // 19,000 + 5,000
  assert.equal(order.discountTotal, 1000);
  assert.equal(order.cgstTotal, 2010); // 1,710 + 300
  assert.equal(order.sgstTotal, 2010); // 1,710 + 300
  assert.equal(order.igstTotal, 0);
  assert.equal(order.taxTotal, 4020);
  assert.equal(order.grandTotal, 28020);
  assert.equal(order.items.length, 2);

  // Verify getOrders retrieves the created order
  const ordersList = await getOrders(user.id, org1.id, { type: "SALES" });
  assert.ok(ordersList.some((o) => o.id === order.id));

  // Test empty items rejection
  await assert.rejects(
    async () => {
      await createOrder(user.id, org1.id, {
        type: "SALES",
        customerId: customer.id,
        orderDate: new Date(),
        placeOfSupply: "24",
        items: [],
      });
    },
    {
      name: "Error",
      message: /EMPTY_ORDER/,
    }
  );
});

test("Business - Invoice Lifecycle & Customer Balance Increment", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user);
  assert.ok(org1);

  const customer = await createCustomer(user.id, org1.id, {
    name: `Invoice Test Client ${Date.now()}`,
    stateCode: "27", // Maharashtra (Inter-state with Gujarat)
  });

  assert.equal(customer.balance, 0);

  // Create an inter-state Sales Invoice:
  // Qty 1 @ 50,000 @ 18% IGST -> Taxable 50,000, IGST 9,000, Grand Total 59,000
  const invoice = await createInvoice(user.id, org1.id, {
    type: "SALES",
    customerId: customer.id,
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 86400000),
    placeOfSupply: "27", // Inter-state
    items: [
      {
        description: "Enterprise Cloud License",
        hsnSacCode: "998314",
        quantity: 1,
        unitPrice: 50000,
        gstRate: 18,
      },
    ],
  });

  assert.ok(invoice.id);
  assert.match(invoice.invoiceNumber, /^INV-\d{4}-\d{4}$/);
  assert.equal(invoice.isInterState, true);
  assert.equal(invoice.igstTotal, 9000);
  assert.equal(invoice.cgstTotal, 0);
  assert.equal(invoice.sgstTotal, 0);
  assert.equal(invoice.grandTotal, 59000);
  assert.equal(invoice.amountPaid, 0);
  assert.equal(invoice.status, "ISSUED");

  // Verify Customer balance has incremented by 59,000
  const refreshedCustomer = await prisma.customer.findUnique({
    where: { id: customer.id },
  });
  assert.equal(refreshedCustomer?.balance, 59000, "Customer balance must reflect outstanding invoice");

  // Verify getInvoices retrieves the created invoice
  const invoicesList = await getInvoices(user.id, org1.id, { type: "SALES" });
  assert.ok(invoicesList.some((inv) => inv.id === invoice.id));
});

test("Business - Order to Invoice Conversion", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user);
  assert.ok(org1);

  const customer = await createCustomer(user.id, org1.id, {
    name: `Convert Client ${Date.now()}`,
  });

  // Create Sales Order
  const order = await createOrder(user.id, org1.id, {
    type: "SALES",
    customerId: customer.id,
    orderDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Convertible System Unit",
        hsnSacCode: "8471",
        quantity: 1,
        unitPrice: 10000,
        gstRate: 18,
      },
    ],
  });

  assert.equal(order.status, "DRAFT");

  // Convert to Invoice
  const invoice = await createInvoice(user.id, org1.id, {
    type: "SALES",
    customerId: customer.id,
    orderId: order.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Convertible System Unit",
        hsnSacCode: "8471",
        quantity: 1,
        unitPrice: 10000,
        gstRate: 18,
      },
    ],
  });

  assert.equal(invoice.orderId, order.id);

  // Verify the linked order status changed to COMPLETED
  const refreshedOrder = await prisma.order.findUnique({
    where: { id: order.id },
  });
  assert.equal(refreshedOrder?.status, "COMPLETED", "Converted order status must be COMPLETED");
});

test("Business - Payments, Partial Settlement, Overpayment Guard & Ledger Decrement", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });

  assert.ok(user);
  assert.ok(org1);

  const customer = await createCustomer(user.id, org1.id, {
    name: `Payment Test Client ${Date.now()}`,
    stateCode: "24",
  });

  // Create Invoice: Total 11,800 (10,000 + 18% GST)
  const invoice = await createInvoice(user.id, org1.id, {
    type: "SALES",
    customerId: customer.id,
    invoiceDate: new Date(),
    dueDate: new Date(),
    placeOfSupply: "24",
    items: [
      {
        description: "Support Package",
        hsnSacCode: "998314",
        quantity: 1,
        unitPrice: 10000,
        gstRate: 18,
      },
    ],
  });

  assert.equal(invoice.grandTotal, 11800);

  // Verify initial customer balance
  let cust = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.equal(cust?.balance, 11800);

  // 1. Partial Payment of ₹5,000
  const uniqueRef = `UTR-${Date.now()}`;
  const payment1 = await recordPayment(user.id, org1.id, {
    type: "INCOMING",
    invoiceId: invoice.id,
    amount: 5000,
    paymentDate: new Date(),
    paymentMode: "UPI",
    referenceNumber: uniqueRef,
  });

  assert.ok(payment1.id);
  assert.match(payment1.paymentNumber, /^REC-\d{4}-\d{4}$/);

  // Verify getPayments retrieves the created payment
  const paymentsList = await getPayments(user.id, org1.id, { type: "INCOMING" });
  assert.ok(paymentsList.some((p) => p.id === payment1.id));

  // Check invoice after partial payment
  let refreshedInv = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  assert.equal(refreshedInv?.amountPaid, 5000);
  assert.equal(refreshedInv?.status, "PARTIALLY_PAID");

  // Check customer balance reduced: 11,800 - 5,000 = 6,800
  cust = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.equal(cust?.balance, 6800);

  // 2. Overpayment Rejection: Attempt to pay ₹7,000 when remaining balance is only ₹6,800
  await assert.rejects(
    async () => {
      await recordPayment(user.id, org1.id, {
        type: "INCOMING",
        invoiceId: invoice.id,
        amount: 7000,
        paymentDate: new Date(),
        referenceNumber: `UTR-OVERPAY-${Date.now()}`,
      });
    },
    {
      name: "Error",
      message: /PAYMENT_EXCEEDS_BALANCE/,
    },
    "Payment exceeding remaining due must be rejected"
  );

  // 3. Duplicate Payment Reference Rejection: Attempt to reuse uniqueRef in same org
  await assert.rejects(
    async () => {
      await recordPayment(user.id, org1.id, {
        type: "INCOMING",
        invoiceId: invoice.id,
        amount: 2000,
        paymentDate: new Date(),
        referenceNumber: uniqueRef,
      });
    },
    {
      name: "Error",
      message: /DUPLICATE_PAYMENT/,
    },
    "Duplicate payment reference number in same org must be rejected"
  );

  // 4. Final Settlement Payment of ₹6,800
  const payment2 = await recordPayment(user.id, org1.id, {
    type: "INCOMING",
    invoiceId: invoice.id,
    amount: 6800,
    paymentDate: new Date(),
    paymentMode: "BANK_TRANSFER",
    referenceNumber: `UTR-FINAL-${Date.now()}`,
  });
  assert.ok(payment2.id);

  // Check invoice is now fully PAID
  refreshedInv = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  assert.equal(refreshedInv?.amountPaid, 11800);
  assert.equal(refreshedInv?.status, "PAID");

  // Check customer balance reduced to 0
  cust = await prisma.customer.findUnique({ where: { id: customer.id } });
  assert.equal(cust?.balance, 0, "Customer balance must be 0 after full invoice settlement");
});

test("Business - Role Enforcement & Cross-Tenant Security", async () => {
  const user = await prisma.user.findUnique({
    where: { email: "jenil@theexpanse.local" },
  });
  const restrictedOrg = await prisma.organization.findUnique({
    where: { slug: "restricted-corp" },
  });

  assert.ok(user);
  assert.ok(restrictedOrg);

  // User is not a member of restrictedOrg -> attempt to create customer must fail
  await assert.rejects(
    async () => {
      await createCustomer(user.id, restrictedOrg.id, {
        name: "Unauthorized Customer Attempt",
      });
    },
    {
      name: "TenantAuthorizationError",
    },
    "Must block user with no membership in the organization"
  );

  // Create a user with only VIEWER role in an organization to verify role hierarchy
  const testViewer = await prisma.user.upsert({
    where: { email: "viewer@theexpanse.local" },
    update: {},
    create: {
      email: "viewer@theexpanse.local",
      name: "Viewer Test Account",
    },
  });

  const org1 = await prisma.organization.findUnique({
    where: { slug: "expanse-tech" },
  });
  assert.ok(org1);

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org1.id,
        userId: testViewer.id,
      },
    },
    update: { role: Role.VIEWER },
    create: {
      organizationId: org1.id,
      userId: testViewer.id,
      role: Role.VIEWER,
    },
  });

  // VIEWER can view customers
  const list = await getCustomers(testViewer.id, org1.id);
  assert.ok(Array.isArray(list));

  // VIEWER cannot create customer (requires ACCOUNTANT or higher)
  await assert.rejects(
    async () => {
      await createCustomer(testViewer.id, org1.id, {
        name: "Viewer Illegal Customer",
      });
    },
    (err: unknown) => {
      const e = err as { code?: string; status?: number };
      return e.code === "INSUFFICIENT_ROLE_PERMISSIONS" && e.status === 403;
    },
    "VIEWER must be forbidden from creating customers"
  );
});
