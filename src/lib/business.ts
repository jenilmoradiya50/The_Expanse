import { prisma } from "./prisma";
import { verifyTenantAccess } from "./tenancy";
import { recordAuditLog } from "./audit";
import { calculateGstExclusive } from "./gst";
import { AuditAction, AuditEntity, Role } from "@/types";
import Decimal from "decimal.js";

// Ensure Decimal rounding is half-up for financial consistency
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// =============================================================================
// ATOMIC DOCUMENT SEQUENCE GENERATOR (Concurrency-Safe)
// =============================================================================

export type SequenceDocumentType =
  | "SALES_ORDER"
  | "PURCHASE_ORDER"
  | "SALES_INVOICE"
  | "PURCHASE_INVOICE"
  | "INCOMING_PAYMENT"
  | "OUTGOING_PAYMENT"
  | "STOCK_MOVEMENT";

/**
 * Generates the next sequential document number atomically within a database transaction.
 * Scoped by organizationId, document type, and calendar/fiscal year.
 *
 * Guarantees zero duplicates and no collision under concurrent requests.
 * Preserves pre-existing document numbering on the first call.
 */
export async function getNextDocumentNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txOrPrisma: any,
  organizationId: string,
  type: SequenceDocumentType,
  prefix: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  const existingSeq = await txOrPrisma.documentSequence.findUnique({
    where: {
      organizationId_type_year: {
        organizationId,
        type,
        year,
      },
    },
  });

  let initialVal = 1;
  if (!existingSeq) {
    // If table is newly introduced, inspect existing documents to ensure numbering continues safely
    let maxNum = 0;
    if (type === "SALES_ORDER" || type === "PURCHASE_ORDER") {
      const orderType = type === "SALES_ORDER" ? "SALES" : "PURCHASE";
      const records = await txOrPrisma.order.findMany({
        where: { organizationId, type: orderType, orderNumber: { contains: `-${year}-` } },
        select: { orderNumber: true },
      });
      for (const r of records) {
        const parts = r.orderNumber.split("-");
        const val = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    } else if (type === "SALES_INVOICE" || type === "PURCHASE_INVOICE") {
      const invType = type === "SALES_INVOICE" ? "SALES" : "PURCHASE";
      const records = await txOrPrisma.invoice.findMany({
        where: { organizationId, type: invType, invoiceNumber: { contains: `-${year}-` } },
        select: { invoiceNumber: true },
      });
      for (const r of records) {
        const parts = r.invoiceNumber.split("-");
        const val = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    } else if (type === "INCOMING_PAYMENT" || type === "OUTGOING_PAYMENT") {
      const payType = type === "INCOMING_PAYMENT" ? "INCOMING" : "OUTGOING";
      const records = await txOrPrisma.payment.findMany({
        where: { organizationId, type: payType, paymentNumber: { contains: `-${year}-` } },
        select: { paymentNumber: true },
      });
      for (const r of records) {
        const parts = r.paymentNumber.split("-");
        const val = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    } else if (type === "STOCK_MOVEMENT") {
      const records = await txOrPrisma.stockMovement.findMany({
        where: { organizationId, movementNumber: { contains: `-${year}-` } },
        select: { movementNumber: true },
      });
      for (const r of records) {
        const parts = r.movementNumber.split("-");
        const val = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(val) && val > maxNum) maxNum = val;
      }
    }
    initialVal = maxNum + 1;
  }

  const seq = await txOrPrisma.documentSequence.upsert({
    where: {
      organizationId_type_year: {
        organizationId,
        type,
        year,
      },
    },
    update: {
      currentValue: { increment: 1 },
    },
    create: {
      organizationId,
      type,
      year,
      currentValue: initialVal,
    },
  });

  return `${prefix}-${year}-${String(seq.currentValue).padStart(4, "0")}`;
}

// =============================================================================
// 1. CUSTOMERS & SUPPLIERS (VENDORS)
// =============================================================================

export interface CustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  pan?: string | null;
  stateCode?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  paymentTerms?: string | null;
}

export async function getCustomers(
  userId: string,
  organizationId: string,
  options?: { search?: string; includeArchived?: boolean }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.customer.findMany({
    where: {
      organizationId,
      ...(options?.includeArchived ? {} : { isArchived: false }),
      ...(options?.search
        ? {
            OR: [
              { name: { contains: options.search } },
              { email: { contains: options.search } },
              { phone: { contains: options.search } },
              { gstin: { contains: options.search } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function createCustomer(userId: string, organizationId: string, data: CustomerInput) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  const normGstin = data.gstin && data.gstin.trim() !== "" ? data.gstin.trim().toUpperCase() : null;

  if (normGstin) {
    const existing = await prisma.customer.findFirst({
      where: {
        organizationId,
        gstin: normGstin,
      },
    });
    if (existing) {
      throw new Error(`DUPLICATE_GSTIN: A customer with GSTIN '${normGstin}' already exists in this organization.`);
    }
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        organizationId,
        name: data.name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        gstin: normGstin,
        pan: data.pan ? data.pan.trim().toUpperCase() : null,
        stateCode: data.stateCode?.trim() || null,
        billingAddress: data.billingAddress?.trim() || null,
        shippingAddress: data.shippingAddress?.trim() || null,
        paymentTerms: data.paymentTerms || "NET_30",
      },
    });

    await recordAuditLog({
      organizationId,
      userId: context.userId,
      action: AuditAction.CREATE,
      entity: AuditEntity.CUSTOMER,
      entityId: customer.id,
      newValues: { name: customer.name, gstin: customer.gstin },
    });

    return customer;
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === "P2002") {
      throw new Error(`DUPLICATE_GSTIN: A customer with GSTIN '${normGstin}' already exists in this organization.`);
    }
    throw err;
  }
}

export async function updateCustomer(
  userId: string,
  organizationId: string,
  customerId: string,
  data: Partial<CustomerInput>
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
  });

  if (!existing) {
    throw new Error("NOT_FOUND: Customer not found in the active organization.");
  }

  const normGstin = data.gstin !== undefined
    ? (data.gstin && data.gstin.trim() !== "" ? data.gstin.trim().toUpperCase() : null)
    : undefined;

  try {
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(normGstin !== undefined ? { gstin: normGstin } : {}),
        ...(data.pan !== undefined ? { pan: data.pan ? data.pan.trim().toUpperCase() : null } : {}),
        ...(data.stateCode !== undefined ? { stateCode: data.stateCode?.trim() || null } : {}),
        ...(data.billingAddress !== undefined ? { billingAddress: data.billingAddress?.trim() || null } : {}),
        ...(data.shippingAddress !== undefined ? { shippingAddress: data.shippingAddress?.trim() || null } : {}),
        ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
      },
    });

    await recordAuditLog({
      organizationId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.CUSTOMER,
      entityId: customerId,
      oldValues: { name: existing.name, gstin: existing.gstin },
      newValues: { name: updated.name, gstin: updated.gstin },
    });

    return updated;
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === "P2002") {
      throw new Error(`DUPLICATE_GSTIN: A customer with GSTIN '${normGstin}' already exists in this organization.`);
    }
    throw err;
  }
}

export async function archiveCustomer(userId: string, organizationId: string, customerId: string) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ADMIN);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
  });
  if (!customer) throw new Error("NOT_FOUND: Customer not found.");

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { isArchived: true },
  });

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.STATUS_CHANGE,
    entity: AuditEntity.CUSTOMER,
    entityId: customerId,
    newValues: { isArchived: true },
  });

  return updated;
}

// Vendors (Suppliers)
export interface VendorInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  stateCode?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  paymentTerms?: string | null;
}

export async function getVendors(
  userId: string,
  organizationId: string,
  options?: { search?: string; includeArchived?: boolean }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.vendor.findMany({
    where: {
      organizationId,
      ...(options?.includeArchived ? {} : { isArchived: false }),
      ...(options?.search
        ? {
            OR: [
              { name: { contains: options.search } },
              { email: { contains: options.search } },
              { gstin: { contains: options.search } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function createVendor(userId: string, organizationId: string, data: VendorInput) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  const normGstin = data.gstin && data.gstin.trim() !== "" ? data.gstin.trim().toUpperCase() : null;

  if (normGstin) {
    const existing = await prisma.vendor.findFirst({
      where: {
        organizationId,
        gstin: normGstin,
      },
    });
    if (existing) {
      throw new Error(`DUPLICATE_GSTIN: A vendor with GSTIN '${normGstin}' already exists in this organization.`);
    }
  }

  try {
    const vendor = await prisma.vendor.create({
      data: {
        organizationId,
        name: data.name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        gstin: normGstin,
        pan: data.pan ? data.pan.trim().toUpperCase() : null,
        address: data.address?.trim() || null,
        stateCode: data.stateCode?.trim() || null,
        bankName: data.bankName?.trim() || null,
        bankAccountNumber: data.bankAccountNumber?.trim() || null,
        bankIfsc: data.bankIfsc?.trim() || null,
        paymentTerms: data.paymentTerms || "NET_30",
      },
    });

    await recordAuditLog({
      organizationId,
      userId: context.userId,
      action: AuditAction.CREATE,
      entity: AuditEntity.VENDOR,
      entityId: vendor.id,
      newValues: { name: vendor.name, gstin: vendor.gstin },
    });

    return vendor;
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === "P2002") {
      throw new Error(`DUPLICATE_GSTIN: A vendor with GSTIN '${normGstin}' already exists in this organization.`);
    }
    throw err;
  }
}

export async function updateVendor(
  userId: string,
  organizationId: string,
  vendorId: string,
  data: Partial<VendorInput>
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  const existing = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId },
  });
  if (!existing) throw new Error("NOT_FOUND: Vendor not found in the active organization.");

  const normGstin = data.gstin !== undefined
    ? (data.gstin && data.gstin.trim() !== "" ? data.gstin.trim().toUpperCase() : null)
    : undefined;

  try {
    const updated = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
        ...(normGstin !== undefined ? { gstin: normGstin } : {}),
        ...(data.pan !== undefined ? { pan: data.pan ? data.pan.trim().toUpperCase() : null } : {}),
        ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
        ...(data.stateCode !== undefined ? { stateCode: data.stateCode?.trim() || null } : {}),
        ...(data.bankName !== undefined ? { bankName: data.bankName?.trim() || null } : {}),
        ...(data.bankAccountNumber !== undefined ? { bankAccountNumber: data.bankAccountNumber?.trim() || null } : {}),
        ...(data.bankIfsc !== undefined ? { bankIfsc: data.bankIfsc?.trim() || null } : {}),
        ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
      },
    });

    await recordAuditLog({
      organizationId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entity: AuditEntity.VENDOR,
      entityId: vendorId,
      oldValues: { name: existing.name },
      newValues: { name: updated.name },
    });

    return updated;
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === "P2002") {
      throw new Error(`DUPLICATE_GSTIN: A vendor with GSTIN '${normGstin}' already exists in this organization.`);
    }
    throw err;
  }
}

export async function archiveVendor(userId: string, organizationId: string, vendorId: string) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ADMIN);

  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId },
  });
  if (!vendor) throw new Error("NOT_FOUND: Vendor not found.");

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { isArchived: true },
  });

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.STATUS_CHANGE,
    entity: AuditEntity.VENDOR,
    entityId: vendorId,
    newValues: { isArchived: true },
  });

  return updated;
}

// =============================================================================
// 2. PRODUCTS & SERVICES
// =============================================================================

export interface ProductInput {
  name: string;
  sku?: string | null;
  description?: string | null;
  type?: "PRODUCT" | "SERVICE";
  unit?: string;
  sellingPrice: number;
  purchasePrice?: number;
  hsnSacCode: string;
  gstRate: number;
  trackInventory?: boolean;
}

export async function getProducts(
  userId: string,
  organizationId: string,
  options?: { search?: string; type?: string; isActive?: boolean }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.product.findMany({
    where: {
      organizationId,
      isArchived: false,
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.isActive !== undefined ? { isActive: options.isActive } : {}),
      ...(options?.search
        ? {
            OR: [
              { name: { contains: options.search } },
              { sku: { contains: options.search } },
              { hsnSacCode: { contains: options.search } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function createProduct(userId: string, organizationId: string, data: ProductInput) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  // Check unique SKU within organization
  if (data.sku && data.sku.trim() !== "") {
    const existing = await prisma.product.findFirst({
      where: { organizationId, sku: data.sku.trim().toUpperCase() },
    });
    if (existing) {
      throw new Error(`DUPLICATE_SKU: A product with SKU '${data.sku}' already exists in this organization.`);
    }
  }

  const product = await prisma.product.create({
    data: {
      organizationId,
      name: data.name.trim(),
      sku: data.sku ? data.sku.trim().toUpperCase() : null,
      description: data.description?.trim() || null,
      type: data.type || "PRODUCT",
      unit: data.unit?.trim().toUpperCase() || "NOS",
      sellingPrice: new Decimal(data.sellingPrice).toDecimalPlaces(2).toNumber(),
      purchasePrice: new Decimal(data.purchasePrice || 0).toDecimalPlaces(2).toNumber(),
      hsnSacCode: data.hsnSacCode.trim(),
      gstRate: data.gstRate,
      trackInventory: data.trackInventory !== undefined ? data.trackInventory : (data.type === "SERVICE" ? false : true),
    },
  });

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.CREATE,
    entity: AuditEntity.PRODUCT,
    entityId: product.id,
    newValues: { name: product.name, sku: product.sku, price: product.sellingPrice },
  });

  return product;
}

export async function archiveProduct(userId: string, organizationId: string, productId: string) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ADMIN);

  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
  });
  if (!product) throw new Error("NOT_FOUND: Product not found.");

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { isArchived: true, isActive: false },
  });

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.STATUS_CHANGE,
    entity: AuditEntity.PRODUCT,
    entityId: productId,
    newValues: { isArchived: true },
  });

  return updated;
}

// =============================================================================
// 3. SALES & PURCHASE ORDERS
// =============================================================================

export interface OrderItemInput {
  productId?: string | null;
  description: string;
  hsnSacCode: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  gstRate: number;
}

export interface OrderInput {
  type: "SALES" | "PURCHASE";
  customerId?: string | null;
  vendorId?: string | null;
  orderDate: Date | string;
  expectedDeliveryDate?: Date | string | null;
  placeOfSupply: string;
  notes?: string | null;
  items: OrderItemInput[];
}

export async function createOrder(userId: string, organizationId: string, data: OrderInput) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  if (!data.items || data.items.length === 0) {
    throw new Error("EMPTY_ORDER: An order must contain at least one line item.");
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { gstProfile: true },
  });

  const orgState = org?.gstProfile?.stateCode || "24";
  const isInterState = orgState !== data.placeOfSupply.trim();

  let subtotal = new Decimal(0);
  let discountTotal = new Decimal(0);
  let cgstTotal = new Decimal(0);
  let sgstTotal = new Decimal(0);
  let igstTotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  let grandTotal = new Decimal(0);

  const calculatedItems = data.items.map((item) => {
    const qty = new Decimal(item.quantity);
    const price = new Decimal(item.unitPrice);
    const disc = new Decimal(item.discount || 0);

    const gross = qty.times(price);
    const taxable = gross.minus(disc).toDecimalPlaces(2);

    const gstBreakdown = calculateGstExclusive({
      amount: taxable,
      gstRate: item.gstRate,
      isInterState,
    });

    subtotal = subtotal.plus(taxable);
    discountTotal = discountTotal.plus(disc);
    cgstTotal = cgstTotal.plus(gstBreakdown.cgstAmount);
    sgstTotal = sgstTotal.plus(gstBreakdown.sgstAmount);
    igstTotal = igstTotal.plus(gstBreakdown.igstAmount);
    taxTotal = taxTotal.plus(gstBreakdown.totalTax);
    grandTotal = grandTotal.plus(gstBreakdown.grandTotal);

    return {
      productId: item.productId || null,
      description: item.description,
      hsnSacCode: item.hsnSacCode,
      quantity: item.quantity,
      invoicedQuantity: 0,
      fulfilledQuantity: 0,
      unit: item.unit || "NOS",
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      taxableAmount: taxable.toNumber(),
      gstRate: item.gstRate,
      cgstRate: gstBreakdown.cgstRate,
      cgstAmount: gstBreakdown.cgstAmount,
      sgstRate: gstBreakdown.sgstRate,
      sgstAmount: gstBreakdown.sgstAmount,
      igstRate: gstBreakdown.igstRate,
      igstAmount: gstBreakdown.igstAmount,
      totalAmount: gstBreakdown.grandTotal,
    };
  });

  const orderYear = new Date(data.orderDate).getFullYear();
  const seqType = data.type === "SALES" ? "SALES_ORDER" : "PURCHASE_ORDER";
  const prefix = data.type === "SALES" ? "SO" : "PO";

  return await prisma.$transaction(async (tx) => {
    const orderNumber = await getNextDocumentNumber(tx, organizationId, seqType, prefix, orderYear);

    const order = await tx.order.create({
      data: {
        organizationId,
        orderNumber,
        type: data.type,
        customerId: data.type === "SALES" ? data.customerId : null,
        vendorId: data.type === "PURCHASE" ? data.vendorId : null,
        orderDate: new Date(data.orderDate),
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        placeOfSupply: data.placeOfSupply,
        isInterState,
        status: "DRAFT",
        invoicingStatus: "UNINVOICED",
        subtotal: subtotal.toDecimalPlaces(2).toNumber(),
        cgstTotal: cgstTotal.toDecimalPlaces(2).toNumber(),
        sgstTotal: sgstTotal.toDecimalPlaces(2).toNumber(),
        igstTotal: igstTotal.toDecimalPlaces(2).toNumber(),
        taxTotal: taxTotal.toDecimalPlaces(2).toNumber(),
        discountTotal: discountTotal.toDecimalPlaces(2).toNumber(),
        grandTotal: grandTotal.toDecimalPlaces(2).toNumber(),
        notes: data.notes || null,
        items: {
          create: calculatedItems,
        },
      },
      include: { items: true },
    });

    await recordAuditLog(
      {
        organizationId,
        userId: context.userId,
        action: AuditAction.CREATE,
        entity: AuditEntity.ORDER,
        entityId: order.id,
        newValues: { orderNumber: order.orderNumber, type: order.type, total: order.grandTotal },
      },
      tx
    );

    return order;
  });
}

export async function getOrders(
  userId: string,
  organizationId: string,
  options?: { type?: "SALES" | "PURCHASE"; status?: string; search?: string }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.order.findMany({
    where: {
      organizationId,
      isArchived: false,
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search ? { orderNumber: { contains: options.search } } : {}),
    },
    include: {
      customer: true,
      vendor: true,
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// =============================================================================
// 4. INVOICES (SALES INVOICES & PURCHASE BILLS)
// =============================================================================

export interface InvoiceInput {
  type: "SALES" | "PURCHASE";
  customerId?: string | null;
  vendorId?: string | null;
  orderId?: string | null;
  invoiceDate: Date | string;
  dueDate: Date | string;
  placeOfSupply: string;
  notes?: string | null;
  terms?: string | null;
  items: OrderItemInput[];
}

export async function createInvoice(userId: string, organizationId: string, data: InvoiceInput) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  if (!data.items || data.items.length === 0) {
    throw new Error("EMPTY_INVOICE: An invoice must contain at least one line item.");
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { gstProfile: true },
  });

  const orgState = org?.gstProfile?.stateCode || "24";
  const isInterState = orgState !== data.placeOfSupply.trim();

  let subtotal = new Decimal(0);
  let discountTotal = new Decimal(0);
  let cgstTotal = new Decimal(0);
  let sgstTotal = new Decimal(0);
  let igstTotal = new Decimal(0);
  let taxTotal = new Decimal(0);
  let grandTotal = new Decimal(0);

  const calculatedItems = data.items.map((item) => {
    const qty = new Decimal(item.quantity);
    const price = new Decimal(item.unitPrice);
    const disc = new Decimal(item.discount || 0);

    const gross = qty.times(price);
    const taxable = gross.minus(disc).toDecimalPlaces(2);

    const gstBreakdown = calculateGstExclusive({
      amount: taxable,
      gstRate: item.gstRate,
      isInterState,
    });

    subtotal = subtotal.plus(taxable);
    discountTotal = discountTotal.plus(disc);
    cgstTotal = cgstTotal.plus(gstBreakdown.cgstAmount);
    sgstTotal = sgstTotal.plus(gstBreakdown.sgstAmount);
    igstTotal = igstTotal.plus(gstBreakdown.igstAmount);
    taxTotal = taxTotal.plus(gstBreakdown.totalTax);
    grandTotal = grandTotal.plus(gstBreakdown.grandTotal);

    return {
      productId: item.productId || null,
      description: item.description,
      hsnSacCode: item.hsnSacCode,
      quantity: item.quantity,
      unit: item.unit || "NOS",
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      taxableAmount: taxable.toNumber(),
      gstRate: item.gstRate,
      cgstRate: gstBreakdown.cgstRate,
      cgstAmount: gstBreakdown.cgstAmount,
      sgstRate: gstBreakdown.sgstRate,
      sgstAmount: gstBreakdown.sgstAmount,
      igstRate: gstBreakdown.igstRate,
      igstAmount: gstBreakdown.igstAmount,
      totalAmount: gstBreakdown.grandTotal,
    };
  });

  const finalGrandTotal = grandTotal.toDecimalPlaces(2).toNumber();
  const invoiceYear = new Date(data.invoiceDate).getFullYear();
  const seqType = data.type === "SALES" ? "SALES_INVOICE" : "PURCHASE_INVOICE";
  const prefix = data.type === "SALES" ? "INV" : "BILL";

  return await prisma.$transaction(async (tx) => {
    // 1. Partial invoicing & over-invoicing checks if linked to an order
    if (data.orderId) {
      const order = await tx.order.findFirst({
        where: { id: data.orderId, organizationId },
        include: { items: true },
      });

      if (!order) {
        throw new Error("NOT_FOUND: Linked order not found in the active organization.");
      }

      for (const item of data.items) {
        const orderItem = order.items.find(
          (oi) =>
            (item.productId && oi.productId === item.productId) ||
            oi.description.trim().toLowerCase() === item.description.trim().toLowerCase()
        );

        if (orderItem) {
          const alreadyInvoiced = new Decimal(orderItem.invoicedQuantity || 0);
          const toInvoice = new Decimal(item.quantity);
          const maxOrderQty = new Decimal(orderItem.quantity);

          if (alreadyInvoiced.plus(toInvoice).greaterThan(maxOrderQty)) {
            const remaining = maxOrderQty.minus(alreadyInvoiced);
            throw new Error(
              `OVER_INVOICING: Cannot invoice ${toInvoice} units for '${orderItem.description}'. Only ${remaining} units remain uninvoiced.`
            );
          }

          const updatedInvoicedQty = alreadyInvoiced.plus(toInvoice).toNumber();
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: { invoicedQuantity: updatedInvoicedQty },
          });
          orderItem.invoicedQuantity = updatedInvoicedQty;
        }
      }

      // Determine new invoicingStatus while preserving order fulfilment status
      const allFullyInvoiced = order.items.every(
        (oi) => oi.invoicedQuantity >= oi.quantity
      );
      const someInvoiced = order.items.some(
        (oi) => oi.invoicedQuantity > 0
      );
      const newInvoicingStatus = allFullyInvoiced
        ? "FULLY_INVOICED"
        : someInvoiced
        ? "PARTIALLY_INVOICED"
        : "UNINVOICED";

      // Order status is NOT changed to COMPLETED; only invoicingStatus updates!
      await tx.order.update({
        where: { id: order.id },
        data: { invoicingStatus: newInvoicingStatus },
      });
    }

    // 2. Generate sequential number atomically
    const invoiceNumber = await getNextDocumentNumber(tx, organizationId, seqType, prefix, invoiceYear);

    // 3. Create Invoice
    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        invoiceNumber,
        type: data.type,
        customerId: data.type === "SALES" ? data.customerId : null,
        vendorId: data.type === "PURCHASE" ? data.vendorId : null,
        orderId: data.orderId || null,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        placeOfSupply: data.placeOfSupply,
        isInterState,
        status: "ISSUED",
        subtotal: subtotal.toDecimalPlaces(2).toNumber(),
        cgstTotal: cgstTotal.toDecimalPlaces(2).toNumber(),
        sgstTotal: sgstTotal.toDecimalPlaces(2).toNumber(),
        igstTotal: igstTotal.toDecimalPlaces(2).toNumber(),
        taxTotal: taxTotal.toDecimalPlaces(2).toNumber(),
        discountTotal: discountTotal.toDecimalPlaces(2).toNumber(),
        grandTotal: finalGrandTotal,
        amountPaid: 0,
        notes: data.notes || null,
        terms: data.terms || null,
        items: {
          create: calculatedItems,
        },
      },
      include: { items: true },
    });

    // 4. Update Customer or Vendor balance atomically
    if (data.type === "SALES" && data.customerId) {
      await tx.customer.update({
        where: { id: data.customerId },
        data: { balance: { increment: finalGrandTotal } },
      });
    } else if (data.type === "PURCHASE" && data.vendorId) {
      await tx.vendor.update({
        where: { id: data.vendorId },
        data: { balance: { increment: finalGrandTotal } },
      });
    }

    // 5. Record audit log atomically inside the same transaction
    await recordAuditLog(
      {
        organizationId,
        userId: context.userId,
        action: AuditAction.CREATE,
        entity: AuditEntity.INVOICE,
        entityId: invoice.id,
        newValues: { invoiceNumber: invoice.invoiceNumber, type: invoice.type, grandTotal: invoice.grandTotal },
      },
      tx
    );

    return invoice;
  });
}

export async function getInvoices(
  userId: string,
  organizationId: string,
  options?: { type?: "SALES" | "PURCHASE"; status?: string; search?: string }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.invoice.findMany({
    where: {
      organizationId,
      isArchived: false,
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search ? { invoiceNumber: { contains: options.search } } : {}),
    },
    include: {
      customer: true,
      vendor: true,
      items: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// =============================================================================
// 5. PAYMENTS (INCOMING & OUTGOING)
// =============================================================================

export interface PaymentInput {
  type: "INCOMING" | "OUTGOING";
  invoiceId?: string | null;
  customerId?: string | null;
  vendorId?: string | null;
  amount: number;
  paymentDate: Date | string;
  paymentMode?: string;
  referenceNumber?: string | null;
  notes?: string | null;
}

export async function recordPayment(userId: string, organizationId: string, data: PaymentInput) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  const payAmount = new Decimal(data.amount).toDecimalPlaces(2);
  if (payAmount.lessThanOrEqualTo(0)) {
    throw new Error("INVALID_AMOUNT: Payment amount must be greater than zero.");
  }

  const normRef = data.referenceNumber && data.referenceNumber.trim() !== "" ? data.referenceNumber.trim() : null;
  const paymentYear = new Date(data.paymentDate).getFullYear();
  const seqType = data.type === "INCOMING" ? "INCOMING_PAYMENT" : "OUTGOING_PAYMENT";
  const prefix = data.type === "INCOMING" ? "REC" : "PAY";

  return await prisma.$transaction(async (tx) => {
    // 1. Prevent duplicate payment reference within same organization
    if (normRef) {
      const existingPayment = await tx.payment.findFirst({
        where: {
          organizationId,
          referenceNumber: normRef,
          status: "COMPLETED",
        },
      });
      if (existingPayment) {
        throw new Error(`DUPLICATE_PAYMENT: A payment with reference '${normRef}' has already been processed.`);
      }
    }

    // 2. Validate and lock target invoice balance
    let targetInvoice = null;
    if (data.invoiceId) {
      targetInvoice = await tx.invoice.findFirst({
        where: { id: data.invoiceId, organizationId },
      });

      if (!targetInvoice) {
        throw new Error("NOT_FOUND: Invoice not found in the active organization.");
      }

      const currentPaid = new Decimal(targetInvoice.amountPaid);
      const invoiceTotal = new Decimal(targetInvoice.grandTotal);
      const remainingDue = invoiceTotal.minus(currentPaid);

      if (payAmount.greaterThan(remainingDue)) {
        throw new Error(
          `PAYMENT_EXCEEDS_BALANCE: Payment amount (₹${payAmount}) exceeds outstanding due (₹${remainingDue}).`
        );
      }

      const newPaid = currentPaid.plus(payAmount).toDecimalPlaces(2);
      const isFullyPaid = newPaid.greaterThanOrEqualTo(invoiceTotal);

      // Concurrency-safe conditional update:
      // Verifies amountPaid has not changed since targetInvoice was read
      const updateResult = await tx.invoice.updateMany({
        where: {
          id: targetInvoice.id,
          amountPaid: targetInvoice.amountPaid,
        },
        data: {
          amountPaid: newPaid.toNumber(),
          status: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
        },
      });

      if (updateResult.count === 0) {
        throw new Error(
          "CONCURRENT_PAYMENT_CONFLICT: Invoice balance was modified concurrently by another transaction. Please retry."
        );
      }
    }

    // 3. Generate sequential payment number atomically
    const paymentNumber = await getNextDocumentNumber(tx, organizationId, seqType, prefix, paymentYear);

    // 4. Create Payment record (catches P2002 if concurrent duplicate reference sneaks in)
    let payment;
    try {
      payment = await tx.payment.create({
        data: {
          organizationId,
          paymentNumber,
          type: data.type,
          invoiceId: data.invoiceId || null,
          customerId: data.customerId || targetInvoice?.customerId || null,
          vendorId: data.vendorId || targetInvoice?.vendorId || null,
          amount: payAmount.toNumber(),
          paymentDate: new Date(data.paymentDate),
          paymentMode: data.paymentMode || "BANK_TRANSFER",
          referenceNumber: normRef,
          notes: data.notes || null,
          status: "COMPLETED",
        },
      });
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === "P2002") {
        throw new Error(`DUPLICATE_PAYMENT: A payment with reference '${normRef}' has already been processed.`);
      }
      throw err;
    }

    // 5. Decrement Customer or Vendor balance atomically
    const custId = data.customerId || targetInvoice?.customerId;
    const vendId = data.vendorId || targetInvoice?.vendorId;

    if (data.type === "INCOMING" && custId) {
      await tx.customer.update({
        where: { id: custId },
        data: { balance: { decrement: payAmount.toNumber() } },
      });
    } else if (data.type === "OUTGOING" && vendId) {
      await tx.vendor.update({
        where: { id: vendId },
        data: { balance: { decrement: payAmount.toNumber() } },
      });
    }

    // 6. Record audit log atomically inside same transaction
    await recordAuditLog(
      {
        organizationId,
        userId: context.userId,
        action: AuditAction.CREATE,
        entity: AuditEntity.PAYMENT,
        entityId: payment.id,
        newValues: {
          paymentNumber: payment.paymentNumber,
          amount: payment.amount,
          invoiceId: payment.invoiceId,
          referenceNumber: payment.referenceNumber,
        },
      },
      tx
    );

    return payment;
  });
}

export async function getPayments(
  userId: string,
  organizationId: string,
  options?: { type?: "INCOMING" | "OUTGOING"; search?: string }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.payment.findMany({
    where: {
      organizationId,
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.search ? { referenceNumber: { contains: options.search } } : {}),
    },
    include: {
      invoice: true,
      customer: true,
      vendor: true,
    },
    orderBy: { paymentDate: "desc" },
  });
}

// =============================================================================
// 6. LEDGER RECONCILIATION SERVICES
// =============================================================================

export interface BalanceReconciliationResult {
  entityId: string;
  name: string;
  entityType: "CUSTOMER" | "VENDOR";
  cachedBalance: number;
  expectedBalance: number;
  discrepancy: number;
  isReconciled: boolean;
  fixed: boolean;
  details: {
    outstandingInvoicesCount: number;
    outstandingInvoicesSum: number;
    unallocatedPaymentsCount: number;
    unallocatedPaymentsSum: number;
  };
}

/**
 * Reconciles customer ledger balance against underlying posted invoices and unallocated payments.
 * When autoFix is true, updates the cached balance atomically and records an audit log entry.
 */
export async function reconcileCustomerBalance(
  userId: string,
  organizationId: string,
  customerId: string,
  autoFix = false
): Promise<BalanceReconciliationResult> {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    include: {
      invoices: {
        where: {
          type: "SALES",
          isArchived: false,
          status: { not: "CANCELLED" },
        },
      },
      payments: {
        where: {
          type: "INCOMING",
          status: "COMPLETED",
        },
        include: {
          invoice: true,
        },
      },
    },
  });

  if (!customer) {
    throw new Error("NOT_FOUND: Customer not found in the active organization.");
  }

  // 1. Calculate outstanding balance from active, non-cancelled, non-archived sales invoices.
  // Payments already allocated to these invoices are reflected in `inv.amountPaid`.
  let outstandingSum = new Decimal(0);
  let outstandingCount = 0;
  for (const inv of customer.invoices) {
    const due = new Decimal(inv.grandTotal).minus(inv.amountPaid);
    if (due.greaterThan(0)) {
      outstandingSum = outstandingSum.plus(due);
      outstandingCount++;
    }
  }

  // 2. Identify unallocated payments and credits:
  // - Direct unallocated advances (invoiceId === null)
  // - Payments made towards invoices that were subsequently CANCELLED or ARCHIVED
  // (Prevents double deduction: payments on active invoices are already deducted via `amountPaid` above).
  let unallocatedSum = new Decimal(0);
  let unallocatedCount = 0;
  for (const p of customer.payments) {
    const isUnallocated = !p.invoiceId;
    const isLinkedToCancelledOrArchived =
      p.invoice && (p.invoice.status === "CANCELLED" || p.invoice.isArchived);

    if (isUnallocated || isLinkedToCancelledOrArchived) {
      unallocatedSum = unallocatedSum.plus(p.amount);
      unallocatedCount++;
    }
  }

  const expectedBalance = outstandingSum.minus(unallocatedSum).toDecimalPlaces(2).toNumber();
  const cachedBalance = new Decimal(customer.balance).toDecimalPlaces(2).toNumber();
  const discrepancy = new Decimal(cachedBalance).minus(expectedBalance).toDecimalPlaces(2).toNumber();
  const isReconciled = discrepancy === 0;

  let fixed = false;
  if (autoFix && !isReconciled) {
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: { balance: expectedBalance },
      });

      await recordAuditLog(
        {
          organizationId,
          userId: context.userId,
          action: AuditAction.UPDATE,
          entity: AuditEntity.CUSTOMER,
          entityId: customerId,
          oldValues: { balance: cachedBalance },
          newValues: {
            action: "BALANCE_RECONCILED",
            balance: expectedBalance,
            discrepancy,
          },
        },
        tx
      );
    });
    fixed = true;
  }

  return {
    entityId: customerId,
    name: customer.name,
    entityType: "CUSTOMER",
    cachedBalance,
    expectedBalance,
    discrepancy,
    isReconciled,
    fixed,
    details: {
      outstandingInvoicesCount: outstandingCount,
      outstandingInvoicesSum: outstandingSum.toNumber(),
      unallocatedPaymentsCount: unallocatedCount,
      unallocatedPaymentsSum: unallocatedSum.toNumber(),
    },
  };
}

/**
 * Reconciles vendor ledger balance against underlying purchase bills and unallocated payments.
 * When autoFix is true, updates the cached balance atomically and records an audit log entry.
 */
export async function reconcileVendorBalance(
  userId: string,
  organizationId: string,
  vendorId: string,
  autoFix = false
): Promise<BalanceReconciliationResult> {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, organizationId },
    include: {
      invoices: {
        where: {
          type: "PURCHASE",
          isArchived: false,
          status: { not: "CANCELLED" },
        },
      },
      payments: {
        where: {
          type: "OUTGOING",
          status: "COMPLETED",
        },
        include: {
          invoice: true,
        },
      },
    },
  });

  if (!vendor) {
    throw new Error("NOT_FOUND: Vendor not found in the active organization.");
  }

  // 1. Calculate outstanding balance from active, non-cancelled, non-archived purchase bills.
  // Payments already allocated to these bills are reflected in `bill.amountPaid`.
  let outstandingSum = new Decimal(0);
  let outstandingCount = 0;
  for (const bill of vendor.invoices) {
    const due = new Decimal(bill.grandTotal).minus(bill.amountPaid);
    if (due.greaterThan(0)) {
      outstandingSum = outstandingSum.plus(due);
      outstandingCount++;
    }
  }

  // 2. Identify unallocated payments and credits:
  // - Direct unallocated advances (invoiceId === null)
  // - Payments made towards bills that were subsequently CANCELLED or ARCHIVED
  // (Prevents double deduction: payments on active bills are already deducted via `amountPaid` above).
  let unallocatedSum = new Decimal(0);
  let unallocatedCount = 0;
  for (const p of vendor.payments) {
    const isUnallocated = !p.invoiceId;
    const isLinkedToCancelledOrArchived =
      p.invoice && (p.invoice.status === "CANCELLED" || p.invoice.isArchived);

    if (isUnallocated || isLinkedToCancelledOrArchived) {
      unallocatedSum = unallocatedSum.plus(p.amount);
      unallocatedCount++;
    }
  }

  const expectedBalance = outstandingSum.minus(unallocatedSum).toDecimalPlaces(2).toNumber();
  const cachedBalance = new Decimal(vendor.balance).toDecimalPlaces(2).toNumber();
  const discrepancy = new Decimal(cachedBalance).minus(expectedBalance).toDecimalPlaces(2).toNumber();
  const isReconciled = discrepancy === 0;

  let fixed = false;
  if (autoFix && !isReconciled) {
    await prisma.$transaction(async (tx) => {
      await tx.vendor.update({
        where: { id: vendorId },
        data: { balance: expectedBalance },
      });

      await recordAuditLog(
        {
          organizationId,
          userId: context.userId,
          action: AuditAction.UPDATE,
          entity: AuditEntity.VENDOR,
          entityId: vendorId,
          oldValues: { balance: cachedBalance },
          newValues: {
            action: "BALANCE_RECONCILED",
            balance: expectedBalance,
            discrepancy,
          },
        },
        tx
      );
    });
    fixed = true;
  }

  return {
    entityId: vendorId,
    name: vendor.name,
    entityType: "VENDOR",
    cachedBalance,
    expectedBalance,
    discrepancy,
    isReconciled,
    fixed,
    details: {
      outstandingInvoicesCount: outstandingCount,
      outstandingInvoicesSum: outstandingSum.toNumber(),
      unallocatedPaymentsCount: unallocatedCount,
      unallocatedPaymentsSum: unallocatedSum.toNumber(),
    },
  };
}
