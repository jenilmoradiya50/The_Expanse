import { prisma } from "./prisma";
import { verifyTenantAccess } from "./tenancy";
import { recordAuditLog } from "./audit";
import { calculateGstExclusive } from "./gst";
import { AuditAction, AuditEntity, Role } from "@/types";
import Decimal from "decimal.js";

// Ensure Decimal rounding is half-up for financial consistency
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

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

  // Prevent duplicate customers with the same GSTIN or Email within the same organization
  if (data.gstin && data.gstin.trim() !== "") {
    const existing = await prisma.customer.findFirst({
      where: {
        organizationId,
        gstin: data.gstin.trim().toUpperCase(),
        isArchived: false,
      },
    });
    if (existing) {
      throw new Error(`DUPLICATE_GSTIN: A customer with GSTIN '${data.gstin}' already exists in this organization.`);
    }
  }

  const customer = await prisma.customer.create({
    data: {
      organizationId,
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
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

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.gstin !== undefined ? { gstin: data.gstin ? data.gstin.trim().toUpperCase() : null } : {}),
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

  if (data.gstin && data.gstin.trim() !== "") {
    const existing = await prisma.vendor.findFirst({
      where: {
        organizationId,
        gstin: data.gstin.trim().toUpperCase(),
        isArchived: false,
      },
    });
    if (existing) {
      throw new Error(`DUPLICATE_GSTIN: A vendor with GSTIN '${data.gstin}' already exists in this organization.`);
    }
  }

  const vendor = await prisma.vendor.create({
    data: {
      organizationId,
      name: data.name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
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

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.gstin !== undefined ? { gstin: data.gstin ? data.gstin.trim().toUpperCase() : null } : {}),
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
  customerId?: string | null; // For SALES
  vendorId?: string | null;   // For PURCHASE
  orderDate: Date | string;
  expectedDeliveryDate?: Date | string | null;
  placeOfSupply: string; // 2-digit Indian State Code
  notes?: string | null;
  items: OrderItemInput[];
}

export async function createOrder(userId: string, organizationId: string, data: OrderInput) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  if (!data.items || data.items.length === 0) {
    throw new Error("EMPTY_ORDER: An order must contain at least one line item.");
  }

  // Fetch organization GST profile to determine Inter vs Intra-state
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { gstProfile: true },
  });

  const orgState = org?.gstProfile?.stateCode || "24"; // default Gujarat
  const isInterState = orgState !== data.placeOfSupply.trim();

  // Calculate order totals with Decimal precision
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

  // Generate sequential order number (SO-XXXX or PO-XXXX)
  const count = await prisma.order.count({ where: { organizationId, type: data.type } });
  const prefix = data.type === "SALES" ? "SO" : "PO";
  const orderNumber = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const order = await prisma.order.create({
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

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.CREATE,
    entity: AuditEntity.ORDER,
    entityId: order.id,
    newValues: { orderNumber: order.orderNumber, type: order.type, total: order.grandTotal },
  });

  return order;
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
  customerId?: string | null; // For SALES
  vendorId?: string | null;   // For PURCHASE
  orderId?: string | null;    // Linked Order if converted
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

  // Fetch organization GST profile to determine Inter vs Intra-state
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

  // Generate sequential invoice number (INV-XXXX or BILL-XXXX)
  const count = await prisma.invoice.count({ where: { organizationId, type: data.type } });
  const prefix = data.type === "SALES" ? "INV" : "BILL";
  const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const finalGrandTotal = grandTotal.toDecimalPlaces(2).toNumber();

  const invoice = await prisma.invoice.create({
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

  // Update Customer or Vendor balance
  if (data.type === "SALES" && data.customerId) {
    await prisma.customer.update({
      where: { id: data.customerId },
      data: {
        balance: { increment: finalGrandTotal },
      },
    });
  } else if (data.type === "PURCHASE" && data.vendorId) {
    await prisma.vendor.update({
      where: { id: data.vendorId },
      data: {
        balance: { increment: finalGrandTotal },
      },
    });
  }

  // If converted from Order, mark order as COMPLETED
  if (data.orderId) {
    await prisma.order.update({
      where: { id: data.orderId },
      data: { status: "COMPLETED" },
    });
  }

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.CREATE,
    entity: AuditEntity.INVOICE,
    entityId: invoice.id,
    newValues: { invoiceNumber: invoice.invoiceNumber, type: invoice.type, grandTotal: invoice.grandTotal },
  });

  return invoice;
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

  // Prevent duplicate payment entry with identical reference number within same org
  if (data.referenceNumber && data.referenceNumber.trim() !== "") {
    const existingPayment = await prisma.payment.findFirst({
      where: {
        organizationId,
        referenceNumber: data.referenceNumber.trim(),
        status: "COMPLETED",
      },
    });
    if (existingPayment) {
      throw new Error(`DUPLICATE_PAYMENT: A payment with reference '${data.referenceNumber}' has already been processed.`);
    }
  }

  let targetInvoice = null;
  if (data.invoiceId) {
    targetInvoice = await prisma.invoice.findFirst({
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
  }

  // Generate sequential payment number (REC-XXXX or PAY-XXXX)
  const count = await prisma.payment.count({ where: { organizationId, type: data.type } });
  const prefix = data.type === "INCOMING" ? "REC" : "PAY";
  const paymentNumber = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const payment = await prisma.payment.create({
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
      referenceNumber: data.referenceNumber?.trim() || null,
      notes: data.notes || null,
      status: "COMPLETED",
    },
  });

  // Update Invoice amountPaid and status
  if (targetInvoice) {
    const newPaid = new Decimal(targetInvoice.amountPaid).plus(payAmount).toDecimalPlaces(2);
    const invoiceTotal = new Decimal(targetInvoice.grandTotal);
    const isFullyPaid = newPaid.greaterThanOrEqualTo(invoiceTotal);

    await prisma.invoice.update({
      where: { id: targetInvoice.id },
      data: {
        amountPaid: newPaid.toNumber(),
        status: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
      },
    });
  }

  // Update Customer or Vendor outstanding balance
  if (data.type === "INCOMING" && (data.customerId || targetInvoice?.customerId)) {
    const custId = data.customerId || targetInvoice?.customerId;
    if (custId) {
      await prisma.customer.update({
        where: { id: custId },
        data: { balance: { decrement: payAmount.toNumber() } },
      });
    }
  } else if (data.type === "OUTGOING" && (data.vendorId || targetInvoice?.vendorId)) {
    const vendId = data.vendorId || targetInvoice?.vendorId;
    if (vendId) {
      await prisma.vendor.update({
        where: { id: vendId },
        data: { balance: { decrement: payAmount.toNumber() } },
      });
    }
  }

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.CREATE,
    entity: AuditEntity.PAYMENT,
    entityId: payment.id,
    newValues: {
      paymentNumber: payment.paymentNumber,
      amount: payment.amount,
      invoiceId: payment.invoiceId,
    },
  });

  return payment;
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
