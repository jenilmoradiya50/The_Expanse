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
  type CustomerInput,
  type VendorInput,
  type ProductInput,
  type OrderInput,
  type InvoiceInput,
  type PaymentInput,
} from "./business";
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
  ]);

  // High-precision Decimal Aggregations
  let totalRevenue = new Decimal(0);
  let outstandingReceivables = new Decimal(0);
  for (const inv of salesInvoices) {
    totalRevenue = totalRevenue.plus(inv.grandTotal);
    const due = new Decimal(inv.grandTotal).minus(inv.amountPaid);
    if (due.greaterThan(0)) {
      outstandingReceivables = outstandingReceivables.plus(due);
    }
  }

  let totalPurchases = new Decimal(0);
  let outstandingPayables = new Decimal(0);
  for (const bill of purchaseInvoices) {
    totalPurchases = totalPurchases.plus(bill.grandTotal);
    const due = new Decimal(bill.grandTotal).minus(bill.amountPaid);
    if (due.greaterThan(0)) {
      outstandingPayables = outstandingPayables.plus(due);
    }
  }

  let totalDirectExpenses = new Decimal(0);
  for (const exp of expenses) {
    totalDirectExpenses = totalDirectExpenses.plus(exp.amount);
  }

  let cashInflow = new Decimal(0);
  for (const p of incomingPayments) {
    cashInflow = cashInflow.plus(p.amount);
  }

  let cashOutflow = new Decimal(0);
  for (const p of outgoingPayments) {
    cashOutflow = cashOutflow.plus(p.amount);
  }
  cashOutflow = cashOutflow.plus(totalDirectExpenses);

  const netCashFlow = cashInflow.minus(cashOutflow);
  const netProfit = totalRevenue.minus(totalPurchases).minus(totalDirectExpenses);

  return {
    organization: {
      id: context.organizationId,
      name: context.organizationName,
      slug: context.organizationSlug,
      role: context.role,
    },
    metrics: {
      totalRevenue: totalRevenue.toNumber(),
      totalIncome: totalRevenue.toNumber(),
      totalExpenses: totalPurchases.plus(totalDirectExpenses).toNumber(),
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
