"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getAuthenticatedUser, ACTIVE_ORG_COOKIE } from "./session";
import { verifyTenantAccess, assertPersonalOwnership } from "./tenancy";
import { recordAuditLog } from "./audit";
import {
  createCustomer,
  archiveCustomer,
  createVendor,
  archiveVendor,
  createProduct,
  archiveProduct,
  createOrder,
  createInvoice,
  recordPayment,
  reconcileCustomerBalance,
  reconcileVendorBalance,
  type CustomerInput,
  type VendorInput,
  type ProductInput,
  type OrderInput,
  type InvoiceInput,
  type PaymentInput,
} from "./business";
import {
  createWarehouse,
  archiveWarehouse,
  createStockLocation,
  archiveStockLocation,
  recordStockMovement,
  type WarehouseInput,
  type StockLocationInput,
  type StockMovementInput,
} from "./inventory";
import { AuditAction, AuditEntity } from "@/types";
import Decimal from "decimal.js";

/**
 * Server action to switch active organization workspace.
 * Always verifies server-side membership before persisting selection.
 */
export async function switchOrganizationAction(organizationId: string) {
  const user = await getAuthenticatedUser();

  // Strict server-side verification: Throws if user is not a member
  await verifyTenantAccess(user.id, organizationId);

  // Set HTTP-only secure cookie
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  await recordAuditLog({
    organizationId,
    userId: user.id,
    action: AuditAction.UPDATE,
    entity: AuditEntity.ORGANIZATION,
    entityId: organizationId,
    newValues: { action: "SWITCH_ACTIVE_WORKSPACE", targetOrgId: organizationId },
  });

  revalidatePath("/");
  return { success: true, activeOrgId: organizationId };
}

// =============================================================================
// PHASE 4 SERVER ACTIONS FOR BUSINESS OPERATIONS
// =============================================================================

export async function createCustomerAction(organizationId: string, data: CustomerInput) {
  const user = await getAuthenticatedUser();
  const customer = await createCustomer(user.id, organizationId, data);
  revalidatePath("/");
  return customer;
}

export async function archiveCustomerAction(organizationId: string, customerId: string) {
  const user = await getAuthenticatedUser();
  const res = await archiveCustomer(user.id, organizationId, customerId);
  revalidatePath("/");
  return res;
}

export async function createVendorAction(organizationId: string, data: VendorInput) {
  const user = await getAuthenticatedUser();
  const vendor = await createVendor(user.id, organizationId, data);
  revalidatePath("/");
  return vendor;
}

export async function archiveVendorAction(organizationId: string, vendorId: string) {
  const user = await getAuthenticatedUser();
  const res = await archiveVendor(user.id, organizationId, vendorId);
  revalidatePath("/");
  return res;
}

export async function createProductAction(organizationId: string, data: ProductInput) {
  const user = await getAuthenticatedUser();
  const product = await createProduct(user.id, organizationId, data);
  revalidatePath("/");
  return product;
}

export async function archiveProductAction(organizationId: string, productId: string) {
  const user = await getAuthenticatedUser();
  const res = await archiveProduct(user.id, organizationId, productId);
  revalidatePath("/");
  return res;
}

export async function createOrderAction(organizationId: string, data: OrderInput) {
  const user = await getAuthenticatedUser();
  const order = await createOrder(user.id, organizationId, data);
  revalidatePath("/");
  return order;
}

export async function createInvoiceAction(organizationId: string, data: InvoiceInput) {
  const user = await getAuthenticatedUser();
  const invoice = await createInvoice(user.id, organizationId, data);
  revalidatePath("/");
  return invoice;
}

export async function recordPaymentAction(organizationId: string, data: PaymentInput) {
  const user = await getAuthenticatedUser();
  const payment = await recordPayment(user.id, organizationId, data);
  revalidatePath("/");
  return payment;
}

export async function reconcileCustomerBalanceAction(
  organizationId: string,
  customerId: string,
  autoFix = false
) {
  const user = await getAuthenticatedUser();
  const res = await reconcileCustomerBalance(user.id, organizationId, customerId, autoFix);
  if (autoFix && res.fixed) {
    revalidatePath("/");
  }
  return res;
}

export async function reconcileVendorBalanceAction(
  organizationId: string,
  vendorId: string,
  autoFix = false
) {
  const user = await getAuthenticatedUser();
  const res = await reconcileVendorBalance(user.id, organizationId, vendorId, autoFix);
  if (autoFix && res.fixed) {
    revalidatePath("/");
  }
  return res;
}

// =============================================================================
// PHASE 5.1 SERVER ACTIONS FOR INVENTORY & WAREHOUSE
// =============================================================================

export async function createWarehouseAction(organizationId: string, data: WarehouseInput) {
  const user = await getAuthenticatedUser();
  const warehouse = await createWarehouse(user.id, organizationId, data);
  revalidatePath("/");
  return warehouse;
}

export async function archiveWarehouseAction(organizationId: string, warehouseId: string) {
  const user = await getAuthenticatedUser();
  const res = await archiveWarehouse(user.id, organizationId, warehouseId);
  revalidatePath("/");
  return res;
}

export async function createStockLocationAction(organizationId: string, data: StockLocationInput) {
  const user = await getAuthenticatedUser();
  const location = await createStockLocation(user.id, organizationId, data);
  revalidatePath("/");
  return location;
}

export async function archiveStockLocationAction(organizationId: string, locationId: string) {
  const user = await getAuthenticatedUser();
  const res = await archiveStockLocation(user.id, organizationId, locationId);
  revalidatePath("/");
  return res;
}

export async function recordStockMovementAction(organizationId: string, data: StockMovementInput) {
  const user = await getAuthenticatedUser();
  const movement = await recordStockMovement(user.id, organizationId, data);
  revalidatePath("/");
  return movement;
}

// =============================================================================
// METRICS LOADERS
// =============================================================================

/**
 * Server-side loader for Business Workspace metrics.
 * Strictly enforces organization tenant boundary and calculates real totals.
 */
export async function getBusinessMetrics(organizationId: string) {
  const user = await getAuthenticatedUser();
  const context = await verifyTenantAccess(user.id, organizationId);

  const [
    salesInvoices,
    purchaseInvoices,
    expenses,
    incomingPayments,
    outgoingPayments,
    orders,
    customers,
    vendors,
    products,
    recentAudits,
    warehouses,
    stockLocations,
    stockBalances,
    stockMovements,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: context.organizationId, type: "SALES", isArchived: false },
      include: { customer: true, vendor: true, items: true, payments: true },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.invoice.findMany({
      where: { organizationId: context.organizationId, type: "PURCHASE", isArchived: false },
      include: { customer: true, vendor: true, items: true, payments: true },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.businessExpense.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.payment.findMany({
      where: { organizationId: context.organizationId, type: "INCOMING", status: "COMPLETED" },
      include: { invoice: true, customer: true, vendor: true },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.payment.findMany({
      where: { organizationId: context.organizationId, type: "OUTGOING", status: "COMPLETED" },
      include: { invoice: true, customer: true, vendor: true },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.order.findMany({
      where: { organizationId: context.organizationId, isArchived: false },
      include: { customer: true, vendor: true, items: true },
      orderBy: { orderDate: "desc" },
    }),
    prisma.customer.findMany({
      where: { organizationId: context.organizationId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      where: { organizationId: context.organizationId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { organizationId: context.organizationId, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.warehouse.findMany({
      where: { organizationId: context.organizationId, isArchived: false },
      include: { locations: { where: { isArchived: false } } },
      orderBy: { code: "asc" },
    }),
    prisma.stockLocation.findMany({
      where: { organizationId: context.organizationId, isArchived: false },
      include: { warehouse: true },
      orderBy: { code: "asc" },
    }),
    prisma.stockBalance.findMany({
      where: { organizationId: context.organizationId },
      include: {
        product: true,
        location: { include: { warehouse: true } },
      },
    }),
    prisma.stockMovement.findMany({
      where: { organizationId: context.organizationId },
      include: {
        product: true,
        fromLocation: { include: { warehouse: true } },
        toLocation: { include: { warehouse: true } },
        user: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // =============================================================================
  // FINANCIAL CALCULATION RULES (Statutory Accrual & Cash Accounting)
  //
  // 1. REVENUE (Accrual): Sum of taxable amounts (`subtotal`) of issued Sales Invoices.
  //    GST is an indirect tax collected in trust for the government (liability),
  //    not company revenue.
  // 2. OUTPUT GST (Sales Liability): Sum of `taxTotal` of issued Sales Invoices.
  // 3. ESTIMATED INPUT TAX CREDIT (Purchases): Sum of `taxTotal` on Purchase Bills.
  //    IMPORTANT: Under Section 16 & 17(5) of the Indian CGST Act, purchase GST is NOT
  //    automatically eligible for ITC without GSTR-2B matching, supplier tax payment,
  //    and exclusion of blocked credits (e.g. personal consumption, vehicles, food).
  //    This metric is an ESTIMATE for internal management planning, NOT a statutory claim.
  // 4. ESTIMATED NET GST PAYABLE: Output GST minus Estimated Input Tax Credit.
  // 5. PURCHASES (Accrual): Sum of taxable amounts (`subtotal`) of Purchase Bills.
  // 6. DIRECT EXPENSES: Standalone business expenses. Non-vendor direct expenses
  //    are factored into cash outflow to prevent double-counting vendor bills.
  // 7. OPERATING PROFIT (Accrual): Revenue (taxable) minus Purchases (taxable) minus Direct Expenses.
  // 8. CASH INFLOW: Sum of completed incoming payments received from customers.
  // 9. CASH OUTFLOW: Sum of completed outgoing payments to vendors plus non-vendor direct expenses.
  // 10. NET CASH FLOW: Cash Inflow minus Cash Outflow.
  // 11. OUTSTANDING RECEIVABLES: Sum of unpaid balances on Sales Invoices (`grandTotal - amountPaid`).
  // 12. OUTSTANDING PAYABLES: Sum of unpaid balances on Purchase Bills (`grandTotal - amountPaid`).
  // =============================================================================

  let totalTaxableRevenue = new Decimal(0);
  let totalGstCollected = new Decimal(0);
  let outstandingReceivables = new Decimal(0);

  for (const inv of salesInvoices) {
    totalTaxableRevenue = totalTaxableRevenue.plus(inv.subtotal);
    totalGstCollected = totalGstCollected.plus(inv.taxTotal);
    const due = new Decimal(inv.grandTotal).minus(inv.amountPaid);
    if (due.greaterThan(0)) {
      outstandingReceivables = outstandingReceivables.plus(due);
    }
  }

  let totalTaxablePurchases = new Decimal(0);
  let totalGstInputCredit = new Decimal(0);
  let outstandingPayables = new Decimal(0);

  for (const bill of purchaseInvoices) {
    totalTaxablePurchases = totalTaxablePurchases.plus(bill.subtotal);
    totalGstInputCredit = totalGstInputCredit.plus(bill.taxTotal);
    const due = new Decimal(bill.grandTotal).minus(bill.amountPaid);
    if (due.greaterThan(0)) {
      outstandingPayables = outstandingPayables.plus(due);
    }
  }

  const netGstPayable = totalGstCollected.minus(totalGstInputCredit);

  let totalDirectExpenses = new Decimal(0);
  let directExpensesWithoutVendor = new Decimal(0);
  for (const exp of expenses) {
    totalDirectExpenses = totalDirectExpenses.plus(exp.amount);
    if (!exp.vendorId) {
      directExpensesWithoutVendor = directExpensesWithoutVendor.plus(exp.amount);
    }
  }

  let cashInflow = new Decimal(0);
  for (const p of incomingPayments) {
    cashInflow = cashInflow.plus(p.amount);
  }

  let cashOutflow = new Decimal(0);
  for (const p of outgoingPayments) {
    cashOutflow = cashOutflow.plus(p.amount);
  }
  // Add direct non-vendor expenses to cash outflow (prevents double counting vendor expenses)
  cashOutflow = cashOutflow.plus(directExpensesWithoutVendor);

  const netCashFlow = cashInflow.minus(cashOutflow);
  const netProfit = totalTaxableRevenue.minus(totalTaxablePurchases).minus(totalDirectExpenses);

  // INVENTORY METRICS & BALANCES (Phase 5.1)
  let totalInventoryUnits = 0;
  let totalInventoryValuation = new Decimal(0);
  const productStockMap = new Map<string, number>();

  for (const b of stockBalances) {
    totalInventoryUnits += b.quantity;
    const itemValuation = new Decimal(b.quantity).times(b.product.purchasePrice || b.product.sellingPrice || 0);
    totalInventoryValuation = totalInventoryValuation.plus(itemValuation);
    const existing = productStockMap.get(b.productId) || 0;
    productStockMap.set(b.productId, existing + b.quantity);
  }

  return {
    organization: {
      id: context.organizationId,
      name: context.organizationName,
      slug: context.organizationSlug,
      role: context.role,
    },
    metrics: {
      totalRevenue: totalTaxableRevenue.toNumber(),
      totalIncome: totalTaxableRevenue.toNumber(), // Backwards-compatible alias
      outputGst: totalGstCollected.toNumber(),
      estimatedInputTaxCredit: totalGstInputCredit.toNumber(),
      estimatedNetGstPayable: netGstPayable.toNumber(),
      // Backwards-compatible aliases:
      totalGstCollected: totalGstCollected.toNumber(),
      totalGstInputCredit: totalGstInputCredit.toNumber(),
      netGstPayable: netGstPayable.toNumber(),
      gstNotice:
        "GST calculations are internal management estimates. Purchase GST is treated as potential Input Tax Credit (ITC) for estimation only; statutory claims under Section 16 & Section 17(5) require GSTR-2B reconciliation and vendor compliance. Not an official tax return.",
      totalPurchases: totalTaxablePurchases.toNumber(),
      totalExpenses: totalTaxablePurchases.plus(totalDirectExpenses).toNumber(),
      netProfit: netProfit.toNumber(),
      cashInflow: cashInflow.toNumber(),
      cashOutflow: cashOutflow.toNumber(),
      netCashFlow: netCashFlow.toNumber(),
      outstandingReceivables: outstandingReceivables.toNumber(),
      outstandingPayables: outstandingPayables.toNumber(),
      invoicesCount: salesInvoices.length,
      purchaseBillsCount: purchaseInvoices.length,
      ordersCount: orders.length,
      customersCount: customers.length,
      vendorsCount: vendors.length,
      productsCount: products.length,
      warehousesCount: warehouses.length,
      stockLocationsCount: stockLocations.length,
      totalInventoryUnits,
      totalInventoryValuation: totalInventoryValuation.toNumber(),
      isDemoDataNotice: "All metrics and domain records are calculated from real database entities in this organization.",
    },
    lists: {
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        gstin: c.gstin,
        stateCode: c.stateCode,
        balance: c.balance,
        paymentTerms: c.paymentTerms,
      })),
      vendors: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        email: v.email,
        phone: v.phone,
        gstin: v.gstin,
        stateCode: v.stateCode,
        balance: v.balance,
        paymentTerms: v.paymentTerms,
      })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        type: p.type,
        unit: p.unit,
        sellingPrice: p.sellingPrice,
        purchasePrice: p.purchasePrice,
        hsnSacCode: p.hsnSacCode,
        gstRate: p.gstRate,
        isActive: p.isActive,
        trackInventory: p.trackInventory,
        currentStock: productStockMap.get(p.id) || 0,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        type: o.type,
        status: o.status,
        partnerName: o.type === "SALES" ? o.customer?.name : o.vendor?.name,
        orderDate: o.orderDate.toISOString(),
        grandTotal: o.grandTotal,
        itemsCount: o.items.length,
      })),
      invoices: salesInvoices.concat(purchaseInvoices).map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        status: inv.status,
        partnerName: inv.type === "SALES" ? inv.customer?.name : inv.vendor?.name,
        invoiceDate: inv.invoiceDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        grandTotal: inv.grandTotal,
        amountPaid: inv.amountPaid,
        balanceDue: new Decimal(inv.grandTotal).minus(inv.amountPaid).toNumber(),
      })),
      payments: incomingPayments.concat(outgoingPayments).map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        type: p.type,
        amount: p.amount,
        paymentDate: p.paymentDate.toISOString(),
        paymentMode: p.paymentMode,
        referenceNumber: p.referenceNumber,
        partnerName: p.type === "INCOMING" ? p.customer?.name : p.vendor?.name,
        invoiceNumber: p.invoice?.invoiceNumber ?? null,
      })),
      warehouses: warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        code: w.code,
        address: w.address,
        contactPhone: w.contactPhone,
        contactEmail: w.contactEmail,
        locationsCount: w.locations.length,
      })),
      stockLocations: stockLocations.map((l) => ({
        id: l.id,
        name: l.name,
        code: l.code,
        description: l.description,
        warehouseId: l.warehouseId,
        warehouseName: l.warehouse.name,
        warehouseCode: l.warehouse.code,
      })),
      stockBalances: stockBalances.map((b) => ({
        id: b.id,
        productId: b.productId,
        productName: b.product.name,
        productSku: b.product.sku,
        productUnit: b.product.unit,
        locationId: b.locationId,
        locationName: b.location.name,
        locationCode: b.location.code,
        warehouseName: b.location.warehouse.name,
        warehouseCode: b.location.warehouse.code,
        quantity: b.quantity,
        valuation: new Decimal(b.quantity).times(b.product.purchasePrice || b.product.sellingPrice || 0).toNumber(),
      })),
      stockMovements: stockMovements.map((m) => ({
        id: m.id,
        movementNumber: m.movementNumber,
        type: m.type,
        productId: m.productId,
        productName: m.product.name,
        productSku: m.product.sku,
        productUnit: m.product.unit,
        quantity: m.quantity,
        fromLocation: m.fromLocation ? `${m.fromLocation.warehouse.code} / ${m.fromLocation.code}` : null,
        toLocation: m.toLocation ? `${m.toLocation.warehouse.code} / ${m.toLocation.code}` : null,
        referenceNumber: m.referenceNumber,
        reason: m.reason,
        userName: m.user?.name || "System",
        createdAt: m.createdAt.toISOString(),
      })),
    },
    recentActivity: recentAudits.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      timestamp: a.createdAt.toISOString(),
      details: a.newValues ? JSON.parse(a.newValues) : null,
    })),
  };
}

/**
 * Server-side loader for Personal Finance Workspace metrics.
 * Strictly scoped to authenticated user ID (never touches organization data).
 */
export async function getPersonalMetrics() {
  const user = await getAuthenticatedUser();
  assertPersonalOwnership(user.id, user.id);

  const [accounts, categories, transactions, budgets] = await Promise.all([
    prisma.personalAccount.findMany({
      where: { userId: user.id },
      orderBy: { currentBalance: "desc" },
    }),
    prisma.personalCategory.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    prisma.personalTransaction.findMany({
      where: { userId: user.id },
      include: { account: true, category: true },
      orderBy: { transactionDate: "desc" },
      take: 10,
    }),
    prisma.personalBudget.findMany({
      where: { userId: user.id },
      include: { category: true },
    }),
  ]);

  let totalLiquidAssets = new Decimal(0);
  let totalLiabilities = new Decimal(0);

  for (const acc of accounts) {
    const bal = new Decimal(acc.currentBalance);
    if (acc.type === "CREDIT_CARD") {
      totalLiabilities = totalLiabilities.plus(bal);
    } else {
      totalLiquidAssets = totalLiquidAssets.plus(bal);
    }
  }

  const netWorth = totalLiquidAssets.minus(totalLiabilities);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    metrics: {
      totalLiquidAssets: totalLiquidAssets.toNumber(),
      totalLiabilities: totalLiabilities.toNumber(),
      netWorth: netWorth.toNumber(),
      accountsCount: accounts.length,
      categoriesCount: categories.length,
      transactionsCount: transactions.length,
      budgetsCount: budgets.length,
      isDemoDataNotice: "Personal finance records are strictly isolated to the user account (Demo Seeded).",
    },
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.currentBalance,
      currency: a.currency,
      last4: a.accountNumberLast4,
    })),
    recentTransactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      date: t.transactionDate.toISOString(),
      payee: t.payee ?? "Unknown",
      category: t.category?.name ?? "General",
      account: t.account.name,
    })),
  };
}
