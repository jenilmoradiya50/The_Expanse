"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { getAuthenticatedUser, ACTIVE_ORG_COOKIE } from "./session";
import { verifyTenantAccess, assertPersonalOwnership } from "./tenancy";
import { recordAuditLog } from "./audit";
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

  // Record audit event
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

/**
 * Server-side loader for Business Workspace metrics.
 * Strictly enforces organization tenant boundary.
 */
export async function getBusinessMetrics(organizationId: string) {
  const user = await getAuthenticatedUser();
  const context = await verifyTenantAccess(user.id, organizationId);

  const [invoices, expenses, customersCount, vendorsCount, recentAudits] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: context.organizationId },
      select: {
        id: true,
        invoiceNumber: true,
        grandTotal: true,
        amountPaid: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.businessExpense.findMany({
      where: { organizationId: context.organizationId },
      select: {
        id: true,
        amount: true,
        taxAmount: true,
        paymentStatus: true,
        category: true,
        createdAt: true,
      },
    }),
    prisma.customer.count({ where: { organizationId: context.organizationId } }),
    prisma.vendor.count({ where: { organizationId: context.organizationId } }),
    prisma.auditLog.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // High-precision decimal aggregation
  let totalIncome = new Decimal(0);
  let outstandingReceivables = new Decimal(0);
  for (const inv of invoices) {
    totalIncome = totalIncome.plus(inv.amountPaid);
    const due = new Decimal(inv.grandTotal).minus(inv.amountPaid);
    if (due.greaterThan(0)) {
      outstandingReceivables = outstandingReceivables.plus(due);
    }
  }

  let totalExpenses = new Decimal(0);
  for (const exp of expenses) {
    totalExpenses = totalExpenses.plus(exp.amount);
  }

  const netProfit = totalIncome.minus(totalExpenses);

  return {
    organization: {
      id: context.organizationId,
      name: context.organizationName,
      slug: context.organizationSlug,
      role: context.role,
    },
    metrics: {
      totalIncome: totalIncome.toNumber(),
      totalExpenses: totalExpenses.toNumber(),
      netProfit: netProfit.toNumber(),
      outstandingReceivables: outstandingReceivables.toNumber(),
      invoicesCount: invoices.length,
      expensesCount: expenses.length,
      customersCount,
      vendorsCount,
      isDemoDataNotice: "All displayed figures are calculated from development/demo sample records.",
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
