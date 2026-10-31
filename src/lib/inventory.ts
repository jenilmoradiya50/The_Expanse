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
  input: StockMovementInput
) {
  const context = await verifyTenantAccess(userId, organizationId, Role.ACCOUNTANT);

  // 1. Verify Product ownership & inventory tracking capability
  const product = await prisma.product.findFirst({
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

  // Execute entire inventory update inside an atomic transaction
  return await prisma.$transaction(async (tx) => {
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
  });
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
