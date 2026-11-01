import Decimal from "decimal.js";
import { prisma } from "./prisma";
import { verifyTenantAccess } from "./tenancy";
import { recordAuditLog } from "./audit";
import { getNextDocumentNumber } from "./business";
import { Role, AuditAction, AuditEntity, StockMovementType, type StockMovementTypeEnum } from "@/types";

// Ensure Decimal calculation precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// =============================================================================
// DOMAIN INPUT INTERFACES
// =============================================================================

export interface WarehouseInput {
  name: string;
  code: string;
  address?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
}

export interface StockLocationInput {
  warehouseId: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface StockMovementInput {
  productId: string;
  type: StockMovementTypeEnum;
  quantity?: number; // strictly positive magnitude of movement
  fromLocationId?: string | null;
  toLocationId?: string | null;
  referenceNumber?: string | null;
  reason?: string | null;
  targetQuantity?: number; // optional physical count for ADJUSTMENT
}

export interface FulfilmentItemInput {
  orderItemId: string;
  locationId?: string | null;
  quantity: number; // strictly positive
}

export interface SalesFulfilmentInput {
  orderId: string;
  items: FulfilmentItemInput[];
  notes?: string | null;
  idempotencyKey?: string | null;
}

export interface PurchaseReceiptInput {
  orderId: string;
  items: FulfilmentItemInput[];
  allowOverReceipt?: boolean;
  notes?: string | null;
  idempotencyKey?: string | null;
}

// =============================================================================
// 1. WAREHOUSE MANAGEMENT SERVICES
// =============================================================================

/**
 * Creates a new warehouse scoped to the verified organization.
 * Enforces organization-level unique warehouse code.
 */
export async function createWarehouse(
  userId: string,
  organizationId: string,
  data: WarehouseInput
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ADMIN);

  const cleanName = data.name?.trim();
  const cleanCode = data.code?.trim().toUpperCase();

  if (!cleanName) {
    throw new Error("INVALID_INPUT: Warehouse name is required.");
  }
  if (!cleanCode) {
    throw new Error("INVALID_INPUT: Warehouse code is required.");
  }

  // Check unique code within organization
  const existing = await prisma.warehouse.findUnique({
    where: {
      organizationId_code: {
        organizationId,
        code: cleanCode,
      },
    },
  });

  if (existing) {
    throw new Error(`DUPLICATE_CODE: A warehouse with code '${cleanCode}' already exists in this organization.`);
  }

  const warehouse = await prisma.warehouse.create({
    data: {
      organizationId,
      name: cleanName,
      code: cleanCode,
      address: data.address?.trim() || null,
      contactPhone: data.contactPhone?.trim() || null,
      contactEmail: data.contactEmail?.trim() || null,
    },
  });

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.CREATE,
    entity: AuditEntity.WAREHOUSE,
    entityId: warehouse.id,
    newValues: {
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address,
    },
  });

  return warehouse;
}

/**
 * Lists warehouses for the organization with location counts.
 */
export async function getWarehouses(
  userId: string,
  organizationId: string,
  options?: { includeArchived?: boolean; search?: string }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.warehouse.findMany({
    where: {
      organizationId,
      ...(options?.includeArchived ? {} : { isArchived: false }),
      ...(options?.search
        ? {
            OR: [
              { name: { contains: options.search } },
              { code: { contains: options.search } },
            ],
          }
        : {}),
    },
    include: {
      locations: {
        where: options?.includeArchived ? {} : { isArchived: false },
        orderBy: { code: "asc" },
      },
      _count: {
        select: {
          locations: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });
}

/**
 * Soft-archives a warehouse and audits the operation.
 */
export async function archiveWarehouse(
  userId: string,
  organizationId: string,
  warehouseId: string
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ADMIN);

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, organizationId },
  });

  if (!warehouse) {
    throw new Error("NOT_FOUND: Warehouse not found in the active organization.");
  }

  const updated = await prisma.warehouse.update({
    where: { id: warehouseId },
    data: { isArchived: true },
  });

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.UPDATE,
    entity: AuditEntity.WAREHOUSE,
    entityId: warehouse.id,
    oldValues: { isArchived: warehouse.isArchived },
    newValues: { isArchived: true, action: "ARCHIVED" },
  });

  return updated;
}

// =============================================================================
// 2. STOCK LOCATION SERVICES
// =============================================================================

/**
 * Creates a stock location within a warehouse.
 * Enforces warehouse-scoped unique location code.
 */
export async function createStockLocation(
  userId: string,
  organizationId: string,
  data: StockLocationInput
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ADMIN);

  const cleanName = data.name?.trim();
  const cleanCode = data.code?.trim().toUpperCase();

  if (!cleanName) {
    throw new Error("INVALID_INPUT: Location name is required.");
  }
  if (!cleanCode) {
    throw new Error("INVALID_INPUT: Location code is required.");
  }

  // Verify warehouse belongs to active organization and is not archived
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: data.warehouseId, organizationId, isArchived: false },
  });

  if (!warehouse) {
    throw new Error("NOT_FOUND: Active warehouse not found in this organization.");
  }

  // Check unique code within warehouse
  const existing = await prisma.stockLocation.findUnique({
    where: {
      warehouseId_code: {
        warehouseId: data.warehouseId,
        code: cleanCode,
      },
    },
  });

  if (existing) {
    throw new Error(
      `DUPLICATE_CODE: A location with code '${cleanCode}' already exists in warehouse '${warehouse.name}'.`
    );
  }

  const location = await prisma.stockLocation.create({
    data: {
      organizationId,
      warehouseId: data.warehouseId,
      name: cleanName,
      code: cleanCode,
      description: data.description?.trim() || null,
    },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
    },
  });

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.CREATE,
    entity: AuditEntity.STOCK_LOCATION,
    entityId: location.id,
    newValues: {
      name: location.name,
      code: location.code,
      warehouseId: location.warehouseId,
    },
  });

  return location;
}

/**
 * Lists stock locations for an organization or specific warehouse.
 */
export async function getStockLocations(
  userId: string,
  organizationId: string,
  options?: { warehouseId?: string; includeArchived?: boolean }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.stockLocation.findMany({
    where: {
      organizationId,
      ...(options?.warehouseId ? { warehouseId: options.warehouseId } : {}),
      ...(options?.includeArchived ? {} : { isArchived: false }),
    },
    include: {
      warehouse: {
        select: { id: true, name: true, code: true, isArchived: true },
      },
      balances: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, unit: true },
          },
        },
      },
    },
    orderBy: [{ warehouse: { code: "asc" } }, { code: "asc" }],
  });
}

/**
 * Soft-archives a stock location.
 */
export async function archiveStockLocation(
  userId: string,
  organizationId: string,
  locationId: string
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ADMIN);

  const location = await prisma.stockLocation.findFirst({
    where: { id: locationId, organizationId },
  });

  if (!location) {
    throw new Error("NOT_FOUND: Stock location not found in the active organization.");
  }

  const updated = await prisma.stockLocation.update({
    where: { id: locationId },
    data: { isArchived: true },
  });

  await recordAuditLog({
    organizationId,
    userId: context.userId,
    action: AuditAction.UPDATE,
    entity: AuditEntity.STOCK_LOCATION,
    entityId: location.id,
    oldValues: { isArchived: location.isArchived },
    newValues: { isArchived: true, action: "ARCHIVED" },
  });

  return updated;
}

// =============================================================================
// 3. STOCK MOVEMENTS & ATOMIC LEDGER INVARIANTS
// =============================================================================

/**
 * Records an inventory movement and transactionally updates location stock balances.
 *
 * INVARIANTS ENFORCED:
 * 1. Product must track inventory (trackInventory === true, type !== "SERVICE").
 * 2. Cross-tenant movements are strictly prohibited (product, locations, user verified).
 * 3. StockBalance cannot go negative; insufficient stock is rejected prior to commit.
 * 4. Transfer movements atomically decrement source and increment destination.
 * 5. StockMovement is the source of truth; all balance adjustments are audit logged.
 */
export async function recordStockMovement(
  userId: string,
  organizationId: string,
  input: StockMovementInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txOverride?: any
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  const client = txOverride || prisma;

  // 1. Verify Product ownership & inventory tracking capability
  const product = await client.product.findFirst({
    where: { id: input.productId, organizationId, isArchived: false },
  });

  if (!product) {
    throw new Error("NOT_FOUND: Active product not found in the active organization.");
  }

  if (!product.trackInventory || product.type === "SERVICE") {
    throw new Error(
      `NON_INVENTORY_PRODUCT: Product '${product.name}' (${product.sku || "No SKU"}) does not track physical inventory.`
    );
  }

  // 2. Validate Movement Type & Parameters
  const type = input.type;
  if (!Object.values(StockMovementType).includes(type)) {
    throw new Error(`INVALID_TYPE: Unknown movement type '${type}'.`);
  }

  // Execute inventory update inside atomic transaction or provided transactional context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeOperation = async (tx: any) => {
    let moveQty: Decimal;
    let fromLocId: string | null = null;
    let toLocId: string | null = null;

    if (type === "INCOMING") {
      // INCOMING requires a valid destination location
      if (!input.toLocationId) {
        throw new Error("INVALID_INPUT: Destination location (toLocationId) is required for INCOMING stock.");
      }
      if (input.fromLocationId) {
        throw new Error("INVALID_INPUT: Source location (fromLocationId) cannot be specified for INCOMING stock.");
      }

      if (input.quantity === undefined || input.quantity <= 0) {
        throw new Error("INVALID_QUANTITY: Movement quantity must be greater than zero.");
      }

      moveQty = new Decimal(input.quantity);
      toLocId = input.toLocationId;

      // Verify destination location
      const toLoc = await tx.stockLocation.findFirst({
        where: { id: toLocId, organizationId, isArchived: false },
      });
      if (!toLoc) {
        throw new Error("NOT_FOUND: Active destination location not found in this organization.");
      }

      // Read current balance
      const balanceRecord = await tx.stockBalance.findUnique({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: toLocId,
          },
        },
      });

      const currentQty = new Decimal(balanceRecord?.quantity || 0);
      const newQty = currentQty.plus(moveQty);

      await tx.stockBalance.upsert({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: toLocId,
          },
        },
        create: {
          organizationId,
          productId: product.id,
          locationId: toLocId,
          quantity: newQty.toNumber(),
        },
        update: {
          quantity: newQty.toNumber(),
        },
      });
    } else if (type === "OUTGOING") {
      // OUTGOING requires a valid source location
      if (!input.fromLocationId) {
        throw new Error("INVALID_INPUT: Source location (fromLocationId) is required for OUTGOING stock.");
      }
      if (input.toLocationId) {
        throw new Error("INVALID_INPUT: Destination location (toLocationId) cannot be specified for OUTGOING stock.");
      }

      if (input.quantity === undefined || input.quantity <= 0) {
        throw new Error("INVALID_QUANTITY: Movement quantity must be greater than zero.");
      }

      moveQty = new Decimal(input.quantity);
      fromLocId = input.fromLocationId;

      // Verify source location
      const fromLoc = await tx.stockLocation.findFirst({
        where: { id: fromLocId, organizationId, isArchived: false },
      });
      if (!fromLoc) {
        throw new Error("NOT_FOUND: Active source location not found in this organization.");
      }

      // Read current balance
      const balanceRecord = await tx.stockBalance.findUnique({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: fromLocId,
          },
        },
      });

      const currentQty = new Decimal(balanceRecord?.quantity || 0);
      if (currentQty.lessThan(moveQty)) {
        throw new Error(
          `INSUFFICIENT_STOCK: Available stock (${currentQty}) at '${fromLoc.name}' is less than requested quantity (${moveQty}).`
        );
      }

      const newQty = currentQty.minus(moveQty);

      await tx.stockBalance.update({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: fromLocId,
          },
        },
        data: {
          quantity: newQty.toNumber(),
        },
      });
    } else if (type === "TRANSFER") {
      // TRANSFER requires both source and destination locations
      if (!input.fromLocationId || !input.toLocationId) {
        throw new Error("INVALID_INPUT: Both source and destination locations are required for TRANSFER.");
      }
      if (input.fromLocationId === input.toLocationId) {
        throw new Error("INVALID_INPUT: Source and destination locations must be distinct.");
      }

      if (input.quantity === undefined || input.quantity <= 0) {
        throw new Error("INVALID_QUANTITY: Transfer quantity must be greater than zero.");
      }

      moveQty = new Decimal(input.quantity);
      fromLocId = input.fromLocationId;
      toLocId = input.toLocationId;

      // Verify both locations belong to this organization
      const [fromLoc, toLoc] = await Promise.all([
        tx.stockLocation.findFirst({
          where: { id: fromLocId, organizationId, isArchived: false },
        }),
        tx.stockLocation.findFirst({
          where: { id: toLocId, organizationId, isArchived: false },
        }),
      ]);

      if (!fromLoc) {
        throw new Error("NOT_FOUND: Active source location not found in this organization.");
      }
      if (!toLoc) {
        throw new Error("NOT_FOUND: Active destination location not found in this organization.");
      }

      // Check source balance
      const sourceBalance = await tx.stockBalance.findUnique({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: fromLocId,
          },
        },
      });

      const currentSourceQty = new Decimal(sourceBalance?.quantity || 0);
      if (currentSourceQty.lessThan(moveQty)) {
        throw new Error(
          `INSUFFICIENT_STOCK: Available stock (${currentSourceQty}) at source '${fromLoc.name}' is less than transfer quantity (${moveQty}).`
        );
      }

      const newSourceQty = currentSourceQty.minus(moveQty);

      // Read destination balance
      const destBalance = await tx.stockBalance.findUnique({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: toLocId,
          },
        },
      });
      const currentDestQty = new Decimal(destBalance?.quantity || 0);
      const newDestQty = currentDestQty.plus(moveQty);

      // Decrement source
      await tx.stockBalance.update({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: fromLocId,
          },
        },
        data: {
          quantity: newSourceQty.toNumber(),
        },
      });

      // Increment destination
      await tx.stockBalance.upsert({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: toLocId,
          },
        },
        create: {
          organizationId,
          productId: product.id,
          locationId: toLocId,
          quantity: newDestQty.toNumber(),
        },
        update: {
          quantity: newDestQty.toNumber(),
        },
      });
    } else if (type === "ADJUSTMENT") {
      // ADJUSTMENT reconciles physical count audits or manual adjustments
      const targetLocId = input.toLocationId || input.fromLocationId;
      if (!targetLocId) {
        throw new Error("INVALID_INPUT: A location (toLocationId or fromLocationId) is required for stock ADJUSTMENT.");
      }

      const loc = await tx.stockLocation.findFirst({
        where: { id: targetLocId, organizationId, isArchived: false },
      });
      if (!loc) {
        throw new Error("NOT_FOUND: Active location not found in this organization.");
      }

      const balanceRecord = await tx.stockBalance.findUnique({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: targetLocId,
          },
        },
      });

      const currentQty = new Decimal(balanceRecord?.quantity || 0);
      let targetQty: Decimal;

      if (input.targetQuantity !== undefined) {
        if (input.targetQuantity < 0) {
          throw new Error("INVALID_QUANTITY: Target stock count cannot be negative.");
        }
        targetQty = new Decimal(input.targetQuantity);
        const delta = targetQty.minus(currentQty);

        if (delta.equals(0)) {
          throw new Error("NO_CHANGE: Stock count matches current recorded balance exactly.");
        }

        moveQty = delta.abs();
        if (delta.greaterThan(0)) {
          toLocId = targetLocId;
          fromLocId = null;
        } else {
          fromLocId = targetLocId;
          toLocId = null;
        }
      } else {
        if (input.quantity === undefined || input.quantity <= 0) {
          throw new Error("INVALID_QUANTITY: Adjustment quantity must be greater than zero.");
        }
        moveQty = new Decimal(input.quantity);

        if (input.toLocationId) {
          // Positive adjustment (increment)
          toLocId = targetLocId;
          targetQty = currentQty.plus(moveQty);
        } else {
          // Negative adjustment (decrement)
          fromLocId = targetLocId;
          if (currentQty.lessThan(moveQty)) {
            throw new Error(
              `INSUFFICIENT_STOCK: Cannot adjust downwards by ${moveQty}; available balance is only ${currentQty}.`
            );
          }
          targetQty = currentQty.minus(moveQty);
        }
      }

      await tx.stockBalance.upsert({
        where: {
          organizationId_productId_locationId: {
            organizationId,
            productId: product.id,
            locationId: targetLocId,
          },
        },
        create: {
          organizationId,
          productId: product.id,
          locationId: targetLocId,
          quantity: targetQty.toNumber(),
        },
        update: {
          quantity: targetQty.toNumber(),
        },
      });
    } else {
      throw new Error(`UNSUPPORTED_TYPE: Movement type '${type}' is not supported.`);
    }

    // Generate atomic sequential movement number: MOV-YYYY-0001
    const movementNumber = await getNextDocumentNumber(
      tx,
      organizationId,
      "STOCK_MOVEMENT",
      "MOV"
    );

    // Create immutable StockMovement audit record
    const movement = await tx.stockMovement.create({
      data: {
        organizationId,
        productId: product.id,
        movementNumber,
        type,
        quantity: moveQty.toNumber(),
        fromLocationId: fromLocId,
        toLocationId: toLocId,
        referenceNumber: input.referenceNumber?.trim() || null,
        reason: input.reason?.trim() || null,
        userId: context.userId,
      },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        fromLocation: { select: { id: true, name: true, code: true, warehouse: { select: { name: true } } } },
        toLocation: { select: { id: true, name: true, code: true, warehouse: { select: { name: true } } } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Record immutable audit log entry
    await recordAuditLog(
      {
        organizationId,
        userId: context.userId,
        action: AuditAction.CREATE,
        entity: AuditEntity.STOCK_MOVEMENT,
        entityId: movement.id,
        newValues: {
          movementNumber: movement.movementNumber,
          type: movement.type,
          productId: movement.productId,
          quantity: movement.quantity,
          fromLocationId: movement.fromLocationId,
          toLocationId: movement.toLocationId,
          referenceNumber: movement.referenceNumber,
        },
      },
      tx
    );

    return movement;
  };

  return txOverride ? await executeOperation(txOverride) : await prisma.$transaction(executeOperation);
}

// =============================================================================
// 4. INVENTORY QUERY & BALANCE SERVICES
// =============================================================================

/**
 * Retrieves stock balances with product, location, and warehouse relations.
 */
export async function getStockBalances(
  userId: string,
  organizationId: string,
  options?: {
    productId?: string;
    warehouseId?: string;
    locationId?: string;
    search?: string;
  }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.stockBalance.findMany({
    where: {
      organizationId,
      ...(options?.productId ? { productId: options.productId } : {}),
      ...(options?.locationId ? { locationId: options.locationId } : {}),
      ...(options?.warehouseId
        ? { location: { warehouseId: options.warehouseId } }
        : {}),
      ...(options?.search
        ? {
            OR: [
              { product: { name: { contains: options.search } } },
              { product: { sku: { contains: options.search } } },
              { location: { name: { contains: options.search } } },
            ],
          }
        : {}),
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          sellingPrice: true,
          purchasePrice: true,
          trackInventory: true,
        },
      },
      location: {
        select: {
          id: true,
          name: true,
          code: true,
          warehouse: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
    orderBy: [
      { product: { name: "asc" } },
      { location: { warehouse: { code: "asc" } } },
    ],
  });
}

/**
 * Retrieves chronological stock movement history.
 */
export async function getStockMovements(
  userId: string,
  organizationId: string,
  options?: {
    productId?: string;
    type?: StockMovementTypeEnum;
    locationId?: string;
    limit?: number;
  }
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.stockMovement.findMany({
    where: {
      organizationId,
      ...(options?.productId ? { productId: options.productId } : {}),
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.locationId
        ? {
            OR: [
              { fromLocationId: options.locationId },
              { toLocationId: options.locationId },
            ],
          }
        : {}),
    },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      fromLocation: {
        select: {
          id: true,
          name: true,
          code: true,
          warehouse: { select: { name: true, code: true } },
        },
      },
      toLocation: {
        select: {
          id: true,
          name: true,
          code: true,
          warehouse: { select: { name: true, code: true } },
        },
      },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit || 50,
  });
}

/**
 * Aggregates product stock across all locations and warehouses in the organization.
 */
export async function getProductStockOverview(
  userId: string,
  organizationId: string
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  const [products, balances] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId, isArchived: false, trackInventory: true },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        sellingPrice: true,
        purchasePrice: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockBalance.findMany({
      where: { organizationId },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            code: true,
            warehouse: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }),
  ]);

  const balanceMap = new Map<string, { totalStock: number; locations: Array<{ locationName: string; warehouseName: string; quantity: number }> }>();

  for (const b of balances) {
    const existing = balanceMap.get(b.productId) || { totalStock: 0, locations: [] };
    existing.totalStock += b.quantity;
    existing.locations.push({
      locationName: `${b.location.warehouse.code} / ${b.location.code}`,
      warehouseName: b.location.warehouse.name,
      quantity: b.quantity,
    });
    balanceMap.set(b.productId, existing);
  }

  return products.map((p) => {
    const stockInfo = balanceMap.get(p.id) || { totalStock: 0, locations: [] };
    return {
      ...p,
      totalStock: stockInfo.totalStock,
      valuation: new Decimal(stockInfo.totalStock).times(p.purchasePrice || p.sellingPrice).toNumber(),
      locations: stockInfo.locations,
    };
  });
}

// =============================================================================
// 5. ORDER FULFILMENT & GOODS RECEIVING SERVICES (Phase 5.2)
// =============================================================================

/**
 * Executes a partial or complete Sales Order fulfilment.
 *
 * Invariants Enforced:
 * 1. Multi-tenant isolation: order, products, locations, and user must belong to active org.
 * 2. Over-fulfilment protection: fulfilledQuantity + toFulfil cannot exceed ordered quantity.
 * 3. Inventory decrement: physical tracked products require a valid source location with sufficient stock.
 * 4. Services / non-inventory products do not decrement stock or create stock movements.
 * 5. Atomic transaction: order line item updates, stock movements, stock balance decrements,
 *    and audit logs succeed or fail together.
 * 6. Fulfilment status updates independently of invoice status and payment status.
 * 7. Idempotency protection prevents duplicate submissions.
 */
export async function fulfilSalesOrder(
  userId: string,
  organizationId: string,
  input: SalesFulfilmentInput
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  if (!input.items || input.items.length === 0) {
    throw new Error("INVALID_INPUT: Fulfilment must contain at least one line item.");
  }

  // Idempotency check: if an existing fulfilment matches the idempotencyKey in this org, return it immediately
  if (input.idempotencyKey && input.idempotencyKey.trim() !== "") {
    const existing = await prisma.orderFulfilment.findFirst({
      where: {
        organizationId,
        idempotencyKey: input.idempotencyKey.trim(),
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
            location: { select: { id: true, name: true, code: true } },
            stockMovement: { select: { id: true, movementNumber: true } },
          },
        },
        order: { select: { id: true, orderNumber: true, status: true, fulfilmentStatus: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (existing) {
      const existingOrder = await prisma.order.findUnique({
        where: { id: existing.orderId },
        include: { items: { include: { product: true } } },
      });
      return { fulfilment: existing, order: existingOrder, alreadyProcessed: true };
    }
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Lock and verify Sales Order ownership & state
    const order = await tx.order.findFirst({
      where: { id: input.orderId, organizationId, isArchived: false },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new Error("NOT_FOUND: Linked sales order not found in the active organization.");
    }

    if (order.type !== "SALES") {
      throw new Error("INVALID_ORDER_TYPE: Cannot fulfil a non-sales order via sales fulfilment.");
    }

    if (order.status === "CANCELLED") {
      throw new Error("ORDER_CANCELLED: Cannot fulfil a cancelled sales order.");
    }

    const fulfilmentItemsData: Array<{
      organizationId: string;
      orderItemId: string;
      productId: string | null;
      locationId: string | null;
      quantity: number;
      stockMovementId: string | null;
    }> = [];

    // 2. Validate line items and execute stock movements
    for (const itemInput of input.items) {
      if (itemInput.quantity === undefined || itemInput.quantity <= 0) {
        throw new Error("INVALID_QUANTITY: Fulfilment quantity must be greater than zero.");
      }

      const orderItem = order.items.find((oi) => oi.id === itemInput.orderItemId);
      if (!orderItem) {
        throw new Error(
          `NOT_FOUND: Order line item '${itemInput.orderItemId}' does not belong to order '${order.orderNumber}'.`
        );
      }

      const alreadyFulfilled = new Decimal(orderItem.fulfilledQuantity || 0);
      const toFulfil = new Decimal(itemInput.quantity);
      const totalOrderQty = new Decimal(orderItem.quantity);

      if (alreadyFulfilled.plus(toFulfil).greaterThan(totalOrderQty)) {
        const remaining = totalOrderQty.minus(alreadyFulfilled);
        throw new Error(
          `OVER_FULFILMENT: Cannot fulfil ${toFulfil} units for '${orderItem.description}'. Only ${remaining} units remain unfulfilled.`
        );
      }

      const product = orderItem.product;
      const isTracked = product && product.trackInventory && product.type !== "SERVICE";
      let stockMovementId: string | null = null;

      if (isTracked) {
        if (!itemInput.locationId) {
          throw new Error(
            `LOCATION_REQUIRED: Storage location is required to fulfil inventory item '${orderItem.description}'.`
          );
        }

        const location = await tx.stockLocation.findFirst({
          where: { id: itemInput.locationId, organizationId, isArchived: false },
          include: { warehouse: true },
        });

        if (!location) {
          throw new Error("NOT_FOUND: Active source stock location not found in this organization.");
        }

        // Check available stock at source location
        const balance = await tx.stockBalance.findUnique({
          where: {
            organizationId_productId_locationId: {
              organizationId,
              productId: product.id,
              locationId: location.id,
            },
          },
        });

        const availableStock = new Decimal(balance?.quantity || 0);
        if (availableStock.lessThan(toFulfil)) {
          throw new Error(
            `INSUFFICIENT_STOCK: Available stock (${availableStock}) at '${location.name} (${location.code})' is less than requested fulfilment quantity (${toFulfil}).`
          );
        }

        // Atomically record stock movement and decrement location balance using transaction context
        const movement = await recordStockMovement(
          userId,
          organizationId,
          {
            productId: product.id,
            type: StockMovementType.OUTGOING,
            fromLocationId: location.id,
            quantity: toFulfil.toNumber(),
            referenceNumber: order.orderNumber,
            reason: `Sales Order Fulfilment: ${order.orderNumber}`,
          },
          tx
        );
        stockMovementId = movement.id;
      }

      // Increment fulfilledQuantity on order item
      const newFulfilledQty = alreadyFulfilled.plus(toFulfil).toNumber();
      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: { fulfilledQuantity: newFulfilledQty },
      });
      orderItem.fulfilledQuantity = newFulfilledQty;

      fulfilmentItemsData.push({
        organizationId,
        orderItemId: orderItem.id,
        productId: product?.id || null,
        locationId: itemInput.locationId || null,
        quantity: toFulfil.toNumber(),
        stockMovementId,
      });
    }

    // 3. Compute order-level fulfilment status without affecting invoicingStatus
    const allFulfilled = order.items.every((oi) => oi.fulfilledQuantity >= oi.quantity);
    const someFulfilled = order.items.some((oi) => oi.fulfilledQuantity > 0);
    const newFulfilmentStatus = allFulfilled
      ? "FULFILLED"
      : someFulfilled
      ? "PARTIALLY_FULFILLED"
      : "UNFULFILLED";

    const newOrderStatus = allFulfilled
      ? "FULFILLED"
      : someFulfilled
      ? "PARTIALLY_FULFILLED"
      : order.status;

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        fulfilmentStatus: newFulfilmentStatus,
        status: newOrderStatus,
      },
      include: { items: { include: { product: true } } },
    });

    // 4. Generate sequential fulfilment number: FUL-YYYY-XXXX
    const fulfilmentNumber = await getNextDocumentNumber(
      tx,
      organizationId,
      "SALES_FULFILMENT",
      "FUL"
    );

    // 5. Create immutable OrderFulfilment record
    const fulfilment = await tx.orderFulfilment.create({
      data: {
        organizationId,
        orderId: order.id,
        fulfilmentNumber,
        type: "SALES_FULFILMENT",
        status: "COMPLETED",
        idempotencyKey: input.idempotencyKey?.trim() || null,
        notes: input.notes?.trim() || null,
        userId: context.userId,
        items: {
          create: fulfilmentItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
            location: { select: { id: true, name: true, code: true } },
            stockMovement: { select: { id: true, movementNumber: true } },
          },
        },
        order: { select: { id: true, orderNumber: true, status: true, fulfilmentStatus: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // 6. Record Audit Log
    await recordAuditLog(
      {
        organizationId,
        userId: context.userId,
        action: AuditAction.CREATE,
        entity: AuditEntity.ORDER_FULFILMENT,
        entityId: fulfilment.id,
        newValues: {
          fulfilmentNumber: fulfilment.fulfilmentNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          itemsCount: input.items.length,
          fulfilmentStatus: newFulfilmentStatus,
        },
      },
      tx
    );

    return { fulfilment, order: updatedOrder, alreadyProcessed: false };
  });
}

/**
 * Executes a partial or complete Purchase Order receipt (goods inward).
 *
 * Invariants Enforced:
 * 1. Multi-tenant isolation: order, products, locations, and user must belong to active org.
 * 2. Over-receipt protection: prevents receiving more than ordered unless allowOverReceipt is true.
 * 3. Inventory increment: physical tracked products require a valid destination location;
 *    atomically increments stock balance via INCOMING movement.
 * 4. Services / non-inventory products do not increment stock or create stock movements.
 * 5. Atomic transaction: order line item updates, stock movements, stock balance increments,
 *    and audit logs succeed or fail together.
 * 6. Fulfilment status updates independently of invoice status and payment status.
 * 7. Idempotency protection prevents duplicate submissions.
 */
export async function receivePurchaseOrder(
  userId: string,
  organizationId: string,
  input: PurchaseReceiptInput
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  if (!input.items || input.items.length === 0) {
    throw new Error("INVALID_INPUT: Goods receipt must contain at least one line item.");
  }

  // Idempotency check
  if (input.idempotencyKey && input.idempotencyKey.trim() !== "") {
    const existing = await prisma.orderFulfilment.findFirst({
      where: {
        organizationId,
        idempotencyKey: input.idempotencyKey.trim(),
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
            location: { select: { id: true, name: true, code: true } },
            stockMovement: { select: { id: true, movementNumber: true } },
          },
        },
        order: { select: { id: true, orderNumber: true, status: true, fulfilmentStatus: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (existing) {
      const existingOrder = await prisma.order.findUnique({
        where: { id: existing.orderId },
        include: { items: { include: { product: true } } },
      });
      return { fulfilment: existing, order: existingOrder, alreadyProcessed: true };
    }
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Lock and verify Purchase Order ownership & state
    const order = await tx.order.findFirst({
      where: { id: input.orderId, organizationId, isArchived: false },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new Error("NOT_FOUND: Linked purchase order not found in the active organization.");
    }

    if (order.type !== "PURCHASE") {
      throw new Error("INVALID_ORDER_TYPE: Cannot receive goods for a non-purchase order.");
    }

    if (order.status === "CANCELLED") {
      throw new Error("ORDER_CANCELLED: Cannot receive goods for a cancelled purchase order.");
    }

    const fulfilmentItemsData: Array<{
      organizationId: string;
      orderItemId: string;
      productId: string | null;
      locationId: string | null;
      quantity: number;
      stockMovementId: string | null;
    }> = [];

    // 2. Validate line items and execute stock receipts
    for (const itemInput of input.items) {
      if (itemInput.quantity === undefined || itemInput.quantity <= 0) {
        throw new Error("INVALID_QUANTITY: Received quantity must be greater than zero.");
      }

      const orderItem = order.items.find((oi) => oi.id === itemInput.orderItemId);
      if (!orderItem) {
        throw new Error(
          `NOT_FOUND: Order line item '${itemInput.orderItemId}' does not belong to order '${order.orderNumber}'.`
        );
      }

      const alreadyReceived = new Decimal(orderItem.receivedQuantity || orderItem.fulfilledQuantity || 0);
      const toReceive = new Decimal(itemInput.quantity);
      const totalOrderQty = new Decimal(orderItem.quantity);

      if (!input.allowOverReceipt && alreadyReceived.plus(toReceive).greaterThan(totalOrderQty)) {
        const remaining = totalOrderQty.minus(alreadyReceived);
        throw new Error(
          `OVER_RECEIPT: Cannot receive ${toReceive} units for '${orderItem.description}'. Only ${remaining} units remain pending receipt.`
        );
      }

      const product = orderItem.product;
      const isTracked = product && product.trackInventory && product.type !== "SERVICE";
      let stockMovementId: string | null = null;

      if (isTracked) {
        if (!itemInput.locationId) {
          throw new Error(
            `LOCATION_REQUIRED: Destination storage location is required to receive inventory item '${orderItem.description}'.`
          );
        }

        const location = await tx.stockLocation.findFirst({
          where: { id: itemInput.locationId, organizationId, isArchived: false },
          include: { warehouse: true },
        });

        if (!location) {
          throw new Error("NOT_FOUND: Active destination stock location not found in this organization.");
        }

        // Atomically record INCOMING stock movement and increment location balance using transaction context
        const movement = await recordStockMovement(
          userId,
          organizationId,
          {
            productId: product.id,
            type: StockMovementType.INCOMING,
            toLocationId: location.id,
            quantity: toReceive.toNumber(),
            referenceNumber: order.orderNumber,
            reason: `Purchase Order Receipt: ${order.orderNumber}`,
          },
          tx
        );
        stockMovementId = movement.id;
      }

      // Increment receivedQuantity (and fulfilledQuantity for symmetry) on order item
      const newReceivedQty = alreadyReceived.plus(toReceive).toNumber();
      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: {
          receivedQuantity: newReceivedQty,
          fulfilledQuantity: newReceivedQty,
        },
      });
      orderItem.receivedQuantity = newReceivedQty;
      orderItem.fulfilledQuantity = newReceivedQty;

      fulfilmentItemsData.push({
        organizationId,
        orderItemId: orderItem.id,
        productId: product?.id || null,
        locationId: itemInput.locationId || null,
        quantity: toReceive.toNumber(),
        stockMovementId,
      });
    }

    // 3. Compute order-level receipt status
    const allReceived = order.items.every(
      (oi) => (oi.receivedQuantity ?? oi.fulfilledQuantity) >= oi.quantity
    );
    const someReceived = order.items.some(
      (oi) => (oi.receivedQuantity ?? oi.fulfilledQuantity) > 0
    );
    const newFulfilmentStatus = allReceived
      ? "RECEIVED"
      : someReceived
      ? "PARTIALLY_RECEIVED"
      : "UNRECEIVED";

    const newOrderStatus = allReceived
      ? "RECEIVED"
      : someReceived
      ? "PARTIALLY_RECEIVED"
      : order.status;

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        fulfilmentStatus: newFulfilmentStatus,
        status: newOrderStatus,
      },
      include: { items: { include: { product: true } } },
    });

    // 4. Generate sequential receipt number: REC-YYYY-XXXX
    const fulfilmentNumber = await getNextDocumentNumber(
      tx,
      organizationId,
      "PURCHASE_RECEIPT",
      "REC"
    );

    // 5. Create immutable OrderFulfilment record
    const fulfilment = await tx.orderFulfilment.create({
      data: {
        organizationId,
        orderId: order.id,
        fulfilmentNumber,
        type: "PURCHASE_RECEIPT",
        status: "COMPLETED",
        idempotencyKey: input.idempotencyKey?.trim() || null,
        notes: input.notes?.trim() || null,
        userId: context.userId,
        items: {
          create: fulfilmentItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
            location: { select: { id: true, name: true, code: true } },
            stockMovement: { select: { id: true, movementNumber: true } },
          },
        },
        order: { select: { id: true, orderNumber: true, status: true, fulfilmentStatus: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // 6. Record Audit Log
    await recordAuditLog(
      {
        organizationId,
        userId: context.userId,
        action: AuditAction.CREATE,
        entity: AuditEntity.ORDER_FULFILMENT,
        entityId: fulfilment.id,
        newValues: {
          fulfilmentNumber: fulfilment.fulfilmentNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          itemsCount: input.items.length,
          fulfilmentStatus: newFulfilmentStatus,
        },
      },
      tx
    );

    return { fulfilment, order: updatedOrder, alreadyProcessed: false };
  });
}

/**
 * Retrieves all fulfilment/receipt events for a given order in chronological order.
 */
export async function getOrderFulfilments(
  userId: string,
  organizationId: string,
  orderId: string
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  return await prisma.orderFulfilment.findMany({
    where: {
      organizationId,
      orderId,
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          location: {
            select: {
              id: true,
              name: true,
              code: true,
              warehouse: { select: { id: true, name: true, code: true } },
            },
          },
          stockMovement: { select: { id: true, movementNumber: true, type: true } },
        },
      },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Retrieves detailed fulfilment status, line item balances, and available stock across locations.
 */
export async function getOrderFulfilmentDetails(
  userId: string,
  organizationId: string,
  orderId: string
) {
  await verifyTenantAccess(userId, organizationId, Role.VIEWER);

  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId, isArchived: false },
    include: {
      customer: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("NOT_FOUND: Order not found in this organization.");
  }

  // Get active locations with their warehouses
  const locations = await prisma.stockLocation.findMany({
    where: { organizationId, isArchived: false },
    include: { warehouse: { select: { id: true, name: true, code: true } } },
    orderBy: [{ warehouse: { code: "asc" } }, { code: "asc" }],
  });

  // Collect product IDs that track inventory
  const trackedProductIds = order.items
    .map((oi) => oi.product)
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.trackInventory && p.type !== "SERVICE"))
    .map((p) => p.id);

  // Fetch balances for these products across all locations
  const balances = trackedProductIds.length > 0
    ? await prisma.stockBalance.findMany({
        where: {
          organizationId,
          productId: { in: trackedProductIds },
        },
      })
    : [];

  const balanceMap = new Map<string, number>();
  for (const b of balances) {
    balanceMap.set(`${b.productId}_${b.locationId}`, b.quantity);
  }

  const items = order.items.map((oi) => {
    const isSales = order.type === "SALES";
    const fulfilledOrReceived = isSales
      ? oi.fulfilledQuantity
      : (oi.receivedQuantity || oi.fulfilledQuantity);
    const remaining = Math.max(0, oi.quantity - fulfilledOrReceived);
    const isTracked = Boolean(oi.product && oi.product.trackInventory && oi.product.type !== "SERVICE");

    const availableStockByLocation = isTracked && oi.productId
      ? locations.map((loc) => ({
          locationId: loc.id,
          locationName: loc.name,
          locationCode: loc.code,
          warehouseName: loc.warehouse.name,
          warehouseCode: loc.warehouse.code,
          availableStock: balanceMap.get(`${oi.productId}_${loc.id}`) || 0,
        }))
      : [];

    return {
      orderItemId: oi.id,
      productId: oi.productId,
      description: oi.description,
      productName: oi.product?.name || oi.description,
      sku: oi.product?.sku || null,
      unit: oi.unit,
      orderedQuantity: oi.quantity,
      fulfilledQuantity: oi.fulfilledQuantity,
      receivedQuantity: oi.receivedQuantity || oi.fulfilledQuantity,
      remainingQuantity: remaining,
      invoicedQuantity: oi.invoicedQuantity,
      isTrackedInventory: isTracked,
      availableStockByLocation,
    };
  });

  const fulfilments = await getOrderFulfilments(userId, organizationId, orderId);

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      fulfilmentStatus: order.fulfilmentStatus,
      invoicingStatus: order.invoicingStatus,
      orderDate: order.orderDate,
      partnerName: order.customer?.name || order.vendor?.name || "Direct",
    },
    items,
    fulfilments,
    locations: locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      code: loc.code,
      warehouseName: loc.warehouse.name,
      warehouseCode: loc.warehouse.code,
    })),
  };
}
