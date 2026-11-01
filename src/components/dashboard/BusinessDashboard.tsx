"use client";

import { useState, useTransition } from "react";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Clock,
  FileText,
  CreditCard,
  Users,
  Building,
  AlertCircle,
  Plus,
  Search,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Layers,
  FileSpreadsheet,
  Warehouse as WarehouseIcon,
  MapPin,
  ArrowRightLeft,
  Boxes,
  History,
} from "lucide-react";
import {
  createCustomerAction,
  archiveCustomerAction,
  createVendorAction,
  archiveVendorAction,
  createProductAction,
  archiveProductAction,
  createInvoiceAction,
  recordPaymentAction,
  createWarehouseAction,
  archiveWarehouseAction,
  createStockLocationAction,
  archiveStockLocationAction,
  recordStockMovementAction,
  createOrderAction,
  fulfilSalesOrderAction,
  receivePurchaseOrderAction,
  getOrderFulfilmentDetailsAction,
  getOrderFulfilmentsAction,
} from "@/lib/actions";

interface FulfilmentDetailItem {
  orderItemId: string;
  productId: string | null;
  description: string;
  productName: string;
  sku: string | null;
  unit: string | null;
  orderedQuantity: number;
  fulfilledQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  invoicedQuantity: number;
  isTrackedInventory: boolean;
  availableStockByLocation: Array<{
    locationId: string;
    locationName: string;
    locationCode: string;
    warehouseName: string;
    warehouseCode: string;
    availableStock: number;
  }>;
}

interface FulfilmentHistoryItem {
  id: string;
  fulfilmentNumber: string;
  type: string;
  status: string;
  notes?: string | null;
  createdAt: string | Date;
  user?: { id?: string; name?: string | null; email?: string | null } | null;
  items: Array<{
    id: string;
    quantity: number;
    orderItem?: { description?: string | null } | null;
    location?: {
      name: string;
      code: string;
      warehouse?: { name: string; code: string } | null;
    } | null;
    stockMovement?: { id: string; movementNumber: string; type: string } | null;
  }>;
}

interface FulfilmentDetailsData {
  order: {
    id: string;
    orderNumber: string;
    type: string;
    status: string;
    fulfilmentStatus: string;
    invoicingStatus: string;
    orderDate: string | Date;
    partnerName: string;
    customer?: { id: string; name: string } | null;
    vendor?: { id: string; name: string } | null;
  };
  items: FulfilmentDetailItem[];
  fulfilments: FulfilmentHistoryItem[];
  locations: Array<{
    id: string;
    name: string;
    code: string;
    warehouseName: string;
    warehouseCode: string;
  }>;
}

interface BusinessDashboardProps {
  data: {
    organization: {
      id: string;
      name: string;
      slug: string;
      role: string;
    };
    metrics: {
      totalRevenue: number;
      totalIncome?: number;
      outputGst?: number;
      estimatedInputTaxCredit?: number;
      estimatedNetGstPayable?: number;
      totalGstCollected?: number;
      totalGstInputCredit?: number;
      netGstPayable?: number;
      gstNotice?: string;
      totalPurchases?: number;
      totalExpenses: number;
      netProfit: number;
      cashInflow: number;
      cashOutflow: number;
      netCashFlow: number;
      outstandingReceivables: number;
      outstandingPayables: number;
      invoicesCount: number;
      purchaseBillsCount: number;
      ordersCount: number;
      customersCount: number;
      vendorsCount: number;
      productsCount: number;
      warehousesCount?: number;
      stockLocationsCount?: number;
      totalInventoryUnits?: number;
      totalInventoryValuation?: number;
      isDemoDataNotice: string;
    };
    lists: {
      customers: Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        gstin: string | null;
        stateCode: string | null;
        balance: number;
        paymentTerms: string | null;
      }>;
      vendors: Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        gstin: string | null;
        stateCode: string | null;
        balance: number;
        paymentTerms: string | null;
      }>;
      products: Array<{
        id: string;
        name: string;
        sku: string | null;
        type: string;
        unit: string;
        sellingPrice: number;
        purchasePrice: number;
        hsnSacCode: string;
        gstRate: number;
        isActive: boolean;
        trackInventory?: boolean;
        currentStock?: number;
      }>;
      warehouses?: Array<{
        id: string;
        name: string;
        code: string;
        address?: string | null;
        contactPhone?: string | null;
        contactEmail?: string | null;
        locationsCount: number;
      }>;
      stockLocations?: Array<{
        id: string;
        name: string;
        code: string;
        description?: string | null;
        warehouseId: string;
        warehouseName: string;
        warehouseCode: string;
      }>;
      stockBalances?: Array<{
        id: string;
        productId: string;
        productName: string;
        productSku?: string | null;
        productUnit: string;
        locationId: string;
        locationName: string;
        locationCode: string;
        warehouseName: string;
        warehouseCode: string;
        quantity: number;
        valuation: number;
      }>;
      stockMovements?: Array<{
        id: string;
        movementNumber: string;
        type: string;
        productId: string;
        productName: string;
        productSku?: string | null;
        productUnit: string;
        quantity: number;
        fromLocation?: string | null;
        toLocation?: string | null;
        referenceNumber?: string | null;
        reason?: string | null;
        userName: string;
        createdAt: string;
      }>;
      orders: Array<{
        id: string;
        orderNumber: string;
        type: string;
        status: string;
        fulfilmentStatus?: string;
        invoicingStatus?: string;
        partnerName?: string | null;
        orderDate: string;
        grandTotal: number;
        itemsCount: number;
        items?: Array<{
          id: string;
          productId?: string | null;
          description: string;
          quantity: number;
          fulfilledQuantity: number;
          receivedQuantity?: number;
          remainingQuantity: number;
          unit?: string;
          unitPrice: number;
          totalAmount: number;
        }>;
      }>;
      orderFulfilments?: Array<{
        id: string;
        fulfilmentNumber: string;
        type: string;
        status: string;
        orderId: string;
        orderNumber: string;
        orderType: string;
        userName: string;
        notes?: string | null;
        createdAt: string;
        itemsCount: number;
      }>;
      invoices: Array<{
        id: string;
        invoiceNumber: string;
        type: string;
        status: string;
        partnerName?: string | null;
        invoiceDate: string;
        dueDate: string;
        grandTotal: number;
        amountPaid: number;
        balanceDue: number;
      }>;
      payments: Array<{
        id: string;
        paymentNumber: string;
        type: string;
        amount: number;
        paymentDate: string;
        paymentMode: string;
        referenceNumber: string | null;
        partnerName?: string | null;
        invoiceNumber: string | null;
      }>;
    };
    recentActivity: Array<{
      id: string;
      action: string;
      entity: string;
      entityId: string;
      timestamp: string;
      details: unknown;
    }>;
  };
  activeSection: string;
}

export function BusinessDashboard({ data, activeSection }: BusinessDashboardProps) {
  const { organization, metrics, lists, recentActivity } = data;
  const [isPending, startTransition] = useTransition();

  // Search States
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [modalType, setModalType] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form States
  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    gstin: "",
    stateCode: "24",
    paymentTerms: "NET_30",
  });

  const [vendorForm, setVendorForm] = useState({
    name: "",
    email: "",
    phone: "",
    gstin: "",
    stateCode: "24",
    bankName: "",
    bankAccountNumber: "",
    paymentTerms: "NET_30",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    sku: "",
    description: "",
    type: "PRODUCT" as "PRODUCT" | "SERVICE",
    unit: "NOS",
    sellingPrice: 1000,
    purchasePrice: 600,
    hsnSacCode: "8471",
    gstRate: 18,
    trackInventory: true,
  });

  const [invoiceForm, setInvoiceForm] = useState({
    type: "SALES" as "SALES" | "PURCHASE",
    customerId: lists.customers[0]?.id || "",
    vendorId: lists.vendors[0]?.id || "",
    description: "Cloud Architecture & System Engineering",
    hsnSacCode: "998314",
    quantity: 1,
    unitPrice: 25000,
    gstRate: 18,
    placeOfSupply: "24",
  });

  const [paymentForm, setPaymentForm] = useState({
    type: "INCOMING" as "INCOMING" | "OUTGOING",
    invoiceId: lists.invoices[0]?.id || "",
    amount: lists.invoices[0]?.balanceDue || 5000,
    paymentMode: "BANK_TRANSFER",
    referenceNumber: "UTR-REF-001",
  });

  // Inventory Sub-Tab & Forms
  const [inventoryTab, setInventoryTab] = useState<"overview" | "warehouses" | "movements">("overview");

  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    code: "",
    address: "",
    contactPhone: "",
    contactEmail: "",
  });

  const [locationForm, setLocationForm] = useState({
    warehouseId: lists.warehouses?.[0]?.id || "",
    name: "",
    code: "",
    description: "",
  });

  const [movementForm, setMovementForm] = useState({
    productId: lists.products?.find((p) => p.trackInventory !== false)?.id || "",
    type: "INCOMING" as "INCOMING" | "OUTGOING" | "TRANSFER" | "ADJUSTMENT",
    sourceLocationId: lists.stockLocations?.[0]?.id || "",
    destinationLocationId: lists.stockLocations?.[0]?.id || "",
    quantity: 1,
    referenceNumber: "",
    reason: "",
  });

  const getProductStock = (productId: string) => {
    return (
      lists.stockBalances
        ?.filter((b) => b.productId === productId)
        .reduce((sum, b) => sum + b.quantity, 0) ?? 0
    );
  };

  const getLocationStock = (productId: string, locationId: string) => {
    return (
      lists.stockBalances?.find(
        (b) => b.productId === productId && b.locationId === locationId
      )?.quantity ?? 0
    );
  };

  // Phase 5.2 Sub-Tabs & Fulfilment States
  const [salesSubTab, setSalesSubTab] = useState<"invoices" | "orders">("orders");
  const [expensesSubTab, setExpensesSubTab] = useState<"bills" | "orders">("orders");

  const [fulfilmentDetails, setFulfilmentDetails] = useState<FulfilmentDetailsData | null>(null);
  const [fulfilmentHistory, setFulfilmentHistory] = useState<FulfilmentHistoryItem[] | null>(null);
  const [fulfilmentItemsForm, setFulfilmentItemsForm] = useState<
    Array<{ orderItemId: string; locationId: string; quantity: number }>
  >([]);
  const [fulfilmentNotes, setFulfilmentNotes] = useState("");
  const [allowOverReceipt, setAllowOverReceipt] = useState(false);

  const [orderForm, setOrderForm] = useState({
    type: "SALES" as "SALES" | "PURCHASE",
    customerId: lists.customers[0]?.id || "",
    vendorId: lists.vendors[0]?.id || "",
    description: "Enterprise Server Hardware",
    hsnSacCode: "84715000",
    quantity: 10,
    unitPrice: 15000,
    gstRate: 18,
    placeOfSupply: "24",
    notes: "",
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Submissions
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      try {
        await createCustomerAction(organization.id, customerForm);
        setModalType(null);
        setCustomerForm({ name: "", email: "", phone: "", gstin: "", stateCode: "24", paymentTerms: "NET_30" });
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to create customer");
      }
    });
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      try {
        await createVendorAction(organization.id, vendorForm);
        setModalType(null);
        setVendorForm({ name: "", email: "", phone: "", gstin: "", stateCode: "24", bankName: "", bankAccountNumber: "", paymentTerms: "NET_30" });
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to create vendor");
      }
    });
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      try {
        await createProductAction(organization.id, productForm);
        setModalType(null);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to create product");
      }
    });
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      try {
        await createInvoiceAction(organization.id, {
          type: invoiceForm.type,
          customerId: invoiceForm.type === "SALES" ? invoiceForm.customerId : null,
          vendorId: invoiceForm.type === "PURCHASE" ? invoiceForm.vendorId : null,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          placeOfSupply: invoiceForm.placeOfSupply,
          items: [
            {
              description: invoiceForm.description,
              hsnSacCode: invoiceForm.hsnSacCode,
              quantity: Number(invoiceForm.quantity),
              unitPrice: Number(invoiceForm.unitPrice),
              gstRate: Number(invoiceForm.gstRate),
            },
          ],
        });
        setModalType(null);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to create invoice");
      }
    });
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      try {
        await recordPaymentAction(organization.id, {
          type: paymentForm.type,
          invoiceId: paymentForm.invoiceId || null,
          amount: Number(paymentForm.amount),
          paymentDate: new Date(),
          paymentMode: paymentForm.paymentMode,
          referenceNumber: paymentForm.referenceNumber,
        });
        setModalType(null);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to record payment");
      }
    });
  };

  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      try {
        await createWarehouseAction(organization.id, warehouseForm);
        setModalType(null);
        setWarehouseForm({ name: "", code: "", address: "", contactPhone: "", contactEmail: "" });
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to create warehouse");
      }
    });
  };

  const handleArchiveWarehouse = (warehouseId: string) => {
    setFormError(null);
    startTransition(async () => {
      try {
        await archiveWarehouseAction(organization.id, warehouseId);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to archive warehouse");
      }
    });
  };

  const handleCreateStockLocation = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      try {
        await createStockLocationAction(organization.id, locationForm);
        setModalType(null);
        setLocationForm({ warehouseId: lists.warehouses?.[0]?.id || "", name: "", code: "", description: "" });
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to create stock location");
      }
    });
  };

  const handleArchiveStockLocation = (locationId: string) => {
    setFormError(null);
    startTransition(async () => {
      try {
        await archiveStockLocationAction(organization.id, locationId);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to archive location");
      }
    });
  };

  const handleRecordStockMovement = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      try {
        const isNegativeAdjustment = movementForm.type === "ADJUSTMENT" && Number(movementForm.quantity) < 0;
        await recordStockMovementAction(organization.id, {
          productId: movementForm.productId,
          type: movementForm.type,
          fromLocationId:
            movementForm.type === "OUTGOING" || movementForm.type === "TRANSFER"
              ? movementForm.sourceLocationId
              : isNegativeAdjustment
              ? movementForm.sourceLocationId
              : undefined,
          toLocationId:
            movementForm.type === "INCOMING" || movementForm.type === "TRANSFER"
              ? movementForm.destinationLocationId
              : movementForm.type === "ADJUSTMENT" && !isNegativeAdjustment
              ? movementForm.sourceLocationId
              : undefined,
          quantity: Math.abs(Number(movementForm.quantity)),
          referenceNumber: movementForm.referenceNumber || undefined,
          reason: movementForm.reason || undefined,
        });
        setModalType(null);
        setMovementForm({
          productId: lists.products?.find((p) => p.trackInventory !== false)?.id || "",
          type: "INCOMING",
          sourceLocationId: lists.stockLocations?.[0]?.id || "",
          destinationLocationId: lists.stockLocations?.[0]?.id || "",
          quantity: 1,
          referenceNumber: "",
          reason: "",
        });
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to record stock movement");
      }
    });
  };

  const handleOpenFulfilmentModal = (orderId: string) => {
    setFormError(null);
    startTransition(async () => {
      try {
        const details = (await getOrderFulfilmentDetailsAction(organization.id, orderId)) as unknown as FulfilmentDetailsData;
        setFulfilmentDetails(details);
        // Pre-fill fulfilment form with remaining quantities
        const initialItems = details.items.map((it) => {
          const firstLocWithStock = it.availableStockByLocation?.find((l) => l.availableStock > 0)?.locationId;
          const defaultLoc = firstLocWithStock || details.locations[0]?.id || "";
          return {
            orderItemId: it.orderItemId,
            locationId: defaultLoc,
            quantity: it.remainingQuantity,
          };
        });
        setFulfilmentItemsForm(initialItems);
        setFulfilmentNotes("");
        setModalType("fulfil_sales_order");
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to load order fulfilment details");
      }
    });
  };

  const handleOpenReceivingModal = (orderId: string) => {
    setFormError(null);
    startTransition(async () => {
      try {
        const details = (await getOrderFulfilmentDetailsAction(organization.id, orderId)) as unknown as FulfilmentDetailsData;
        setFulfilmentDetails(details);
        const initialItems = details.items.map((it) => ({
          orderItemId: it.orderItemId,
          locationId: details.locations[0]?.id || "",
          quantity: it.remainingQuantity,
        }));
        setFulfilmentItemsForm(initialItems);
        setFulfilmentNotes("");
        setAllowOverReceipt(false);
        setModalType("receive_purchase_order");
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to load order receiving details");
      }
    });
  };

  const handleOpenFulfilmentHistory = (orderId: string) => {
    setFormError(null);
    startTransition(async () => {
      try {
        const history = (await getOrderFulfilmentsAction(organization.id, orderId)) as unknown as FulfilmentHistoryItem[];
        setFulfilmentHistory(history);
        setModalType("fulfilment_history");
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to load fulfilment history");
      }
    });
  };

  const handleSubmitSalesFulfilment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfilmentDetails) return;
    setFormError(null);
    startTransition(async () => {
      try {
        const itemsToSubmit = fulfilmentItemsForm.filter((it) => it.quantity > 0);
        if (itemsToSubmit.length === 0) {
          throw new Error("Please specify a quantity greater than zero for at least one item.");
        }
        await fulfilSalesOrderAction(organization.id, {
          orderId: fulfilmentDetails.order.id,
          items: itemsToSubmit,
          notes: fulfilmentNotes || undefined,
        });
        setModalType(null);
        setFulfilmentDetails(null);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to fulfil sales order");
      }
    });
  };

  const handleSubmitPurchaseReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfilmentDetails) return;
    setFormError(null);
    startTransition(async () => {
      try {
        const itemsToSubmit = fulfilmentItemsForm.filter((it) => it.quantity > 0);
        if (itemsToSubmit.length === 0) {
          throw new Error("Please specify a quantity greater than zero for at least one item.");
        }
        await receivePurchaseOrderAction(organization.id, {
          orderId: fulfilmentDetails.order.id,
          items: itemsToSubmit,
          allowOverReceipt,
          notes: fulfilmentNotes || undefined,
        });
        setModalType(null);
        setFulfilmentDetails(null);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to receive purchase order");
      }
    });
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      try {
        await createOrderAction(organization.id, {
          type: orderForm.type,
          customerId: orderForm.type === "SALES" ? orderForm.customerId : null,
          vendorId: orderForm.type === "PURCHASE" ? orderForm.vendorId : null,
          orderDate: new Date(),
          placeOfSupply: orderForm.placeOfSupply,
          notes: orderForm.notes || undefined,
          items: [
            {
              description: orderForm.description,
              hsnSacCode: orderForm.hsnSacCode,
              quantity: Number(orderForm.quantity),
              unitPrice: Number(orderForm.unitPrice),
              gstRate: Number(orderForm.gstRate),
            },
          ],
        });
        setModalType(null);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : "Failed to create order");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Development Banner */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
        <div>
          <span className="font-semibold uppercase tracking-wider text-[11px] block">
            Multi-Tenant Business Engine Verified:
          </span>
          <p className="text-zinc-300 mt-0.5">
            {metrics.isDemoDataNotice} All calculations run server-side with Decimal precision and immutable audit logging.
          </p>
        </div>
      </div>

      {/* Top Level KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Invoiced Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(metrics.totalRevenue)}
            </h3>
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Total invoiced sales
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Operating Costs
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(metrics.totalExpenses)}
            </h3>
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Purchases & logged expenses
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Net Profit
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-bold tracking-tight ${metrics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatCurrency(metrics.netProfit)}
            </h3>
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Revenue minus total costs
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Receivables Due
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-amber-400 tracking-tight">
              {formatCurrency(metrics.outstandingReceivables)}
            </h3>
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Outstanding client balance
            </span>
          </div>
        </div>
      </div>

      {/* Cash Flow Summary Bar */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Cash Inflow</span>
              <span className="font-bold text-zinc-200">{formatCurrency(metrics.cashInflow)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Cash Outflow</span>
              <span className="font-bold text-zinc-200">{formatCurrency(metrics.cashOutflow)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Net Cash Flow</span>
              <span className={`font-bold ${metrics.netCashFlow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCurrency(metrics.netCashFlow)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-zinc-500 text-[11px]">
          {metrics.netGstPayable !== undefined && (
            <div className="flex items-center gap-3 border-zinc-800 pr-2">
              <span title="GST collected on sales invoices (Output Tax Liability)">
                Output GST: <span className="font-semibold text-amber-300">{formatCurrency(metrics.totalGstCollected ?? 0)}</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span title="Potential ITC from purchase bills (subject to Section 16 & 17(5) statutory eligibility)">
                Est. ITC: <span className="font-semibold text-emerald-300">{formatCurrency(metrics.totalGstInputCredit ?? 0)}</span>
              </span>
              <span className="text-zinc-700">|</span>
              <span title="Estimated net balance due (Output GST - Est. ITC). Not a statutory tax filing.">
                Est. Net GST: <span className="font-semibold text-cyan-400">{formatCurrency(metrics.netGstPayable)}</span>
              </span>
            </div>
          )}
          <div>
            Payables Due: <span className="font-semibold text-zinc-300">{formatCurrency(metrics.outstandingPayables)}</span>
          </div>
        </div>
      </div>

      {/* Dynamic Workspace Content Sections */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-6">
        {/* Header with Search and Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white capitalize flex items-center gap-2">
              <span>{activeSection.replace("-", " ")}</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Workspace: <span className="text-zinc-200 font-medium">{organization.name}</span> ({organization.role})
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input for tables */}
            {activeSection !== "overview" && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Contextual Action Buttons */}
            {activeSection === "customers" && (
              <button
                onClick={() => setModalType("customer")}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Customer
              </button>
            )}

            {activeSection === "vendors" && (
              <button
                onClick={() => setModalType("vendor")}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Vendor
              </button>
            )}

            {activeSection === "inventory" && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    const firstTracked = lists.products.find((p) => p.trackInventory !== false);
                    setMovementForm({
                      productId: firstTracked?.id || "",
                      type: "INCOMING",
                      sourceLocationId: lists.stockLocations?.[0]?.id || "",
                      destinationLocationId: lists.stockLocations?.[0]?.id || "",
                      quantity: 1,
                      referenceNumber: "",
                      reason: "",
                    });
                    setModalType("stock_movement");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Record Movement
                </button>
                <button
                  onClick={() => setModalType("warehouse")}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-700"
                >
                  <WarehouseIcon className="w-3.5 h-3.5 text-zinc-400" />
                  Add Warehouse
                </button>
                <button
                  onClick={() => {
                    setLocationForm({
                      warehouseId: lists.warehouses?.[0]?.id || "",
                      name: "",
                      code: "",
                      description: "",
                    });
                    setModalType("stock_location");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-700"
                >
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  Add Location
                </button>
                <button
                  onClick={() => setModalType("product")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Product
                </button>
              </div>
            )}

            {activeSection === "invoices" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setOrderForm({
                      type: "SALES",
                      customerId: lists.customers[0]?.id || "",
                      vendorId: "",
                      description: "Enterprise Server Hardware",
                      hsnSacCode: "84715000",
                      quantity: 5,
                      unitPrice: 20000,
                      gstRate: 18,
                      placeOfSupply: "24",
                      notes: "",
                    });
                    setModalType("order");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Sales Order
                </button>
                <button
                  onClick={() => {
                    setInvoiceForm({ ...invoiceForm, type: "SALES" });
                    setModalType("invoice");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Invoice
                </button>
              </div>
            )}

            {activeSection === "expenses" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setOrderForm({
                      type: "PURCHASE",
                      customerId: "",
                      vendorId: lists.vendors[0]?.id || "",
                      description: "Component Sub-Assemblies",
                      hsnSacCode: "84715000",
                      quantity: 10,
                      unitPrice: 8000,
                      gstRate: 18,
                      placeOfSupply: "24",
                      notes: "",
                    });
                    setModalType("order");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-zinc-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Purchase Order
                </button>
                <button
                  onClick={() => {
                    setInvoiceForm({ ...invoiceForm, type: "PURCHASE" });
                    setModalType("invoice");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Bill
                </button>
              </div>
            )}

            {activeSection === "payments" && (
              <button
                onClick={() => setModalType("payment")}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Payment
              </button>
            )}
          </div>
        </div>

        {/* 1. OVERVIEW VIEW */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <span className="text-lg font-bold text-zinc-100">{metrics.invoicesCount} Invoices</span>
                  <span className="text-xs text-zinc-400 block">{formatCurrency(metrics.totalRevenue)}</span>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-purple-400" />
                <div>
                  <span className="text-lg font-bold text-zinc-100">{metrics.purchaseBillsCount} Bills</span>
                  <span className="text-xs text-zinc-400 block">{formatCurrency(metrics.totalExpenses)}</span>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center gap-3">
                <Users className="w-5 h-5 text-teal-400" />
                <div>
                  <span className="text-lg font-bold text-zinc-100">{metrics.customersCount} Clients</span>
                  <span className="text-xs text-zinc-400 block">Active records</span>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center gap-3">
                <Building className="w-5 h-5 text-orange-400" />
                <div>
                  <span className="text-lg font-bold text-zinc-100">{metrics.vendorsCount} Suppliers</span>
                  <span className="text-xs text-zinc-400 block">Active vendors</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Recent Tenant Audit Activity
              </h3>
              <div className="space-y-2">
                {recentActivity.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] uppercase font-semibold">
                        {log.action}
                      </span>
                      <span className="text-zinc-200 font-medium">
                        {log.entity} <span className="text-zinc-500 font-mono text-[11px]">({log.entityId})</span>
                      </span>
                    </div>
                    <span className="text-zinc-500">
                      {new Date(log.timestamp).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. CUSTOMERS VIEW */}
        {activeSection === "customers" && (
          <div className="space-y-4">
            {lists.customers.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">No customers found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3">GSTIN / State</th>
                      <th className="py-2.5 px-3">Terms</th>
                      <th className="py-2.5 px-3">Balance</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {lists.customers
                      .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((c) => (
                        <tr key={c.id} className="hover:bg-zinc-800/30">
                          <td className="py-3 px-3 font-medium text-white">{c.name}</td>
                          <td className="py-3 px-3 text-zinc-400">{c.email || c.phone || "—"}</td>
                          <td className="py-3 px-3 font-mono text-zinc-300">{c.gstin || "Unregistered"}</td>
                          <td className="py-3 px-3 text-zinc-400">{c.paymentTerms || "NET_30"}</td>
                          <td className="py-3 px-3 font-semibold text-emerald-400">{formatCurrency(c.balance)}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                startTransition(async () => {
                                  await archiveCustomerAction(organization.id, c.id);
                                });
                              }}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded"
                              title="Archive Customer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. VENDORS VIEW */}
        {activeSection === "vendors" && (
          <div className="space-y-4">
            {lists.vendors.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">No suppliers found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Supplier Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">GSTIN</th>
                      <th className="py-2.5 px-3">Balance</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {lists.vendors
                      .filter((v) => v.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((v) => (
                        <tr key={v.id} className="hover:bg-zinc-800/30">
                          <td className="py-3 px-3 font-medium text-white">{v.name}</td>
                          <td className="py-3 px-3 text-zinc-400">{v.email || "—"}</td>
                          <td className="py-3 px-3 font-mono text-zinc-300">{v.gstin || "—"}</td>
                          <td className="py-3 px-3 font-semibold text-amber-400">{formatCurrency(v.balance)}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                startTransition(async () => {
                                  await archiveVendorAction(organization.id, v.id);
                                });
                              }}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded"
                              title="Archive Vendor"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. INVENTORY / WAREHOUSES & STOCK MANAGEMENT */}
        {activeSection === "inventory" && (
          <div className="space-y-6">
            {/* Inventory Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                  <WarehouseIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Warehouses</span>
                  <span className="text-xl font-bold text-white">
                    {metrics.warehousesCount ?? lists.warehouses?.length ?? 0}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Locations / Bins</span>
                  <span className="text-xl font-bold text-white">
                    {metrics.stockLocationsCount ?? lists.stockLocations?.length ?? 0}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Units On Hand</span>
                  <span className="text-xl font-bold text-emerald-400">
                    {(metrics.totalInventoryUnits ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase font-semibold block">Inventory Valuation</span>
                  <span className="text-xl font-bold text-amber-300">
                    {formatCurrency(metrics.totalInventoryValuation ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-Tabs Bar */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-xs">
              <button
                onClick={() => setInventoryTab("overview")}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                  inventoryTab === "overview"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                Products & Stock Overview
              </button>
              <button
                onClick={() => setInventoryTab("warehouses")}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                  inventoryTab === "warehouses"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <WarehouseIcon className="w-3.5 h-3.5 text-indigo-400" />
                Warehouses & Locations ({lists.warehouses?.length ?? 0})
              </button>
              <button
                onClick={() => setInventoryTab("movements")}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                  inventoryTab === "movements"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                Stock Movement Ledger ({lists.stockMovements?.length ?? 0})
              </button>
            </div>

            {/* SUB-VIEW 1: PRODUCTS & STOCK OVERVIEW */}
            {inventoryTab === "overview" && (
              <div className="space-y-4">
                {lists.products.length === 0 ? (
                  <div className="text-center py-10 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                    <Package className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    No products or services registered yet. Click &quot;Add Product&quot; to register catalog items.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-3">Item Name</th>
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Inventory Tracking</th>
                          <th className="py-2.5 px-3 text-right">Units On Hand</th>
                          <th className="py-2.5 px-3 text-right">Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Selling Price</th>
                          <th className="py-2.5 px-3 text-right">Total Valuation</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {lists.products.map((p) => {
                          const stockUnits = getProductStock(p.id);
                          const totalVal = stockUnits * p.purchasePrice;
                          const isTracked = p.trackInventory !== false;

                          return (
                            <tr key={p.id} className="hover:bg-zinc-800/30">
                              <td className="py-3 px-3 font-medium text-white">
                                {p.name}
                                <span className="block text-[10px] text-zinc-500 font-mono">
                                  HSN: {p.hsnSacCode} | GST: {p.gstRate}%
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-zinc-400">{p.sku || "—"}</td>
                              <td className="py-3 px-3">
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                                  {p.type}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                {isTracked ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-medium">
                                    Tracked
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400">
                                    Non-inventory
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                {isTracked ? (
                                  <span className={stockUnits > 0 ? "text-emerald-400" : "text-amber-400"}>
                                    {stockUnits} {p.unit}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right text-zinc-300">{formatCurrency(p.purchasePrice)}</td>
                              <td className="py-3 px-3 text-right font-semibold text-emerald-400">
                                {formatCurrency(p.sellingPrice)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-semibold text-amber-300">
                                {isTracked ? formatCurrency(totalVal) : "—"}
                              </td>
                              <td className="py-3 px-3 text-right space-x-1">
                                {isTracked && (
                                  <button
                                    onClick={() => {
                                      setMovementForm({
                                        productId: p.id,
                                        type: "INCOMING",
                                        sourceLocationId: lists.stockLocations?.[0]?.id || "",
                                        destinationLocationId: lists.stockLocations?.[0]?.id || "",
                                        quantity: 1,
                                        referenceNumber: "",
                                        reason: "",
                                      });
                                      setModalType("stock_movement");
                                    }}
                                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium transition-colors"
                                    title="Move / Adjust Stock"
                                  >
                                    Move Stock
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    startTransition(async () => {
                                      await archiveProductAction(organization.id, p.id);
                                    });
                                  }}
                                  className="text-zinc-500 hover:text-red-400 p-1 rounded inline-block"
                                  title="Archive Item"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SUB-VIEW 2: WAREHOUSES & LOCATIONS */}
            {inventoryTab === "warehouses" && (
              <div className="space-y-4">
                {(!lists.warehouses || lists.warehouses.length === 0) ? (
                  <div className="text-center py-10 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl space-y-3">
                    <WarehouseIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p>No warehouses registered yet.</p>
                    <button
                      onClick={() => setModalType("warehouse")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                    >
                      Create First Warehouse
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lists.warehouses.map((w) => {
                      const warehouseLocations = lists.stockLocations?.filter((l) => l.warehouseId === w.id) || [];

                      return (
                        <div
                          key={w.id}
                          className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-white">{w.name}</h4>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  {w.code}
                                </span>
                              </div>
                              {w.address && (
                                <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                                  {w.address}
                                </p>
                              )}
                              {(w.contactPhone || w.contactEmail) && (
                                <p className="text-[11px] text-zinc-500 mt-0.5">
                                  {[w.contactPhone, w.contactEmail].filter(Boolean).join(" • ")}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleArchiveWarehouse(w.id)}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded"
                              title="Archive Warehouse"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Nested Locations */}
                          <div className="pt-2 border-t border-zinc-800/80">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                                Storage Locations ({warehouseLocations.length})
                              </span>
                              <button
                                onClick={() => {
                                  setLocationForm({
                                    warehouseId: w.id,
                                    name: "",
                                    code: "",
                                    description: "",
                                  });
                                  setModalType("stock_location");
                                }}
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Location
                              </button>
                            </div>

                            {warehouseLocations.length === 0 ? (
                              <p className="text-[11px] text-zinc-500 italic py-2">
                                No storage racks or bins defined yet in this warehouse.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {warehouseLocations.map((loc) => {
                                  const totalLocUnits = lists.stockBalances
                                    ?.filter((b) => b.locationId === loc.id)
                                    .reduce((acc, b) => acc + b.quantity, 0) ?? 0;

                                  return (
                                    <div
                                      key={loc.id}
                                      className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between text-xs"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-zinc-200">{loc.name}</span>
                                          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-zinc-800 text-zinc-400">
                                            {loc.code}
                                          </span>
                                        </div>
                                        {loc.description && (
                                          <span className="text-[10px] text-zinc-500 block">{loc.description}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="font-mono text-[11px] text-emerald-400">
                                          {totalLocUnits} units
                                        </span>
                                        <button
                                          onClick={() => handleArchiveStockLocation(loc.id)}
                                          className="text-zinc-600 hover:text-red-400"
                                          title="Archive Location"
                                        >
                                          <Archive className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SUB-VIEW 3: STOCK MOVEMENT LEDGER */}
            {inventoryTab === "movements" && (
              <div className="space-y-4">
                {(!lists.stockMovements || lists.stockMovements.length === 0) ? (
                  <div className="text-center py-10 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl space-y-3">
                    <History className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p>No stock movements recorded yet.</p>
                    <button
                      onClick={() => {
                        const firstTracked = lists.products.find((p) => p.trackInventory !== false);
                        setMovementForm({
                          productId: firstTracked?.id || "",
                          type: "INCOMING",
                          sourceLocationId: lists.stockLocations?.[0]?.id || "",
                          destinationLocationId: lists.stockLocations?.[0]?.id || "",
                          quantity: 1,
                          referenceNumber: "",
                          reason: "",
                        });
                        setModalType("stock_movement");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                    >
                      Record First Stock Movement
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-3">Movement #</th>
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Product</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-right">Quantity</th>
                          <th className="py-2.5 px-3">Source / Destination</th>
                          <th className="py-2.5 px-3">Reference / Reason</th>
                          <th className="py-2.5 px-3">User</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {lists.stockMovements.map((m) => {
                          const typeBadgeClasses =
                            m.type === "INCOMING"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : m.type === "OUTGOING"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : m.type === "TRANSFER"
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/20";

                          return (
                            <tr key={m.id} className="hover:bg-zinc-800/30">
                              <td className="py-3 px-3 font-mono font-medium text-white">{m.movementNumber}</td>
                              <td className="py-3 px-3 text-zinc-400 text-[11px] whitespace-nowrap">
                                {new Date(m.createdAt).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-medium text-zinc-200 block">{m.productName}</span>
                                {m.productSku && (
                                  <span className="font-mono text-[10px] text-zinc-500">{m.productSku}</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${typeBadgeClasses}`}
                                >
                                  {m.type}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                {m.type === "INCOMING" && (
                                  <span className="text-emerald-400">+{m.quantity} {m.productUnit}</span>
                                )}
                                {m.type === "OUTGOING" && (
                                  <span className="text-rose-400">-{m.quantity} {m.productUnit}</span>
                                )}
                                {m.type === "TRANSFER" && (
                                  <span className="text-sky-400">{m.quantity} {m.productUnit}</span>
                                )}
                                {m.type === "ADJUSTMENT" && (
                                  <span className={m.quantity >= 0 ? "text-purple-400" : "text-rose-400"}>
                                    {m.quantity >= 0 ? `+${m.quantity}` : m.quantity} {m.productUnit}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-zinc-300 font-mono text-[11px]">
                                {m.type === "INCOMING" && <span>To: {m.toLocation || "—"}</span>}
                                {m.type === "OUTGOING" && <span>From: {m.fromLocation || "—"}</span>}
                                {m.type === "TRANSFER" && (
                                  <span>
                                    {m.fromLocation} → {m.toLocation}
                                  </span>
                                )}
                                {m.type === "ADJUSTMENT" && <span>At: {m.toLocation || m.fromLocation || "—"}</span>}
                              </td>
                              <td className="py-3 px-3 text-zinc-400 text-[11px]">
                                {m.referenceNumber && (
                                  <span className="font-mono text-zinc-300 block">{m.referenceNumber}</span>
                                )}
                                {m.reason && <span className="italic text-zinc-500">{m.reason}</span>}
                                {!m.referenceNumber && !m.reason && "—"}
                              </td>
                              <td className="py-3 px-3 text-zinc-400 text-[11px] whitespace-nowrap">{m.userName}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. INVOICES, ORDERS & FULFILMENT */}
        {(activeSection === "invoices" || activeSection === "expenses") && (
          <div className="space-y-4">
            {/* Sub-Tabs for Orders vs Invoices */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-xs">
              {activeSection === "invoices" ? (
                <>
                  <button
                    onClick={() => setSalesSubTab("orders")}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                      salesSubTab === "orders"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 text-indigo-400" />
                    Sales Orders & Fulfilment ({lists.orders.filter((o) => o.type === "SALES").length})
                  </button>
                  <button
                    onClick={() => setSalesSubTab("invoices")}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                      salesSubTab === "invoices"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    Sales Invoices ({lists.invoices.filter((i) => i.type === "SALES").length})
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setExpensesSubTab("orders")}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                      expensesSubTab === "orders"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 text-sky-400" />
                    Purchase Orders & Goods Inward ({lists.orders.filter((o) => o.type === "PURCHASE").length})
                  </button>
                  <button
                    onClick={() => setExpensesSubTab("bills")}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                      expensesSubTab === "bills"
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                    Purchase Bills & Expenses ({lists.invoices.filter((i) => i.type === "PURCHASE").length})
                  </button>
                </>
              )}
            </div>

            {/* ORDERS TABLE VIEW */}
            {((activeSection === "invoices" && salesSubTab === "orders") ||
              (activeSection === "expenses" && expensesSubTab === "orders")) && (
              <div className="space-y-4">
                {lists.orders.filter((o) => o.type === (activeSection === "invoices" ? "SALES" : "PURCHASE")).length === 0 ? (
                  <div className="text-center py-10 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl space-y-2">
                    <Package className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p>
                      No {activeSection === "invoices" ? "sales" : "purchase"} orders recorded yet.
                    </p>
                    <button
                      onClick={() => {
                        setOrderForm({
                          type: activeSection === "invoices" ? "SALES" : "PURCHASE",
                          customerId: lists.customers[0]?.id || "",
                          vendorId: lists.vendors[0]?.id || "",
                          description: activeSection === "invoices" ? "Enterprise Hardware Delivery" : "Components Inflow",
                          hsnSacCode: "84715000",
                          quantity: 5,
                          unitPrice: 15000,
                          gstRate: 18,
                          placeOfSupply: "24",
                          notes: "",
                        });
                        setModalType("order");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      Create First {activeSection === "invoices" ? "Sales" : "Purchase"} Order
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-3">Order #</th>
                          <th className="py-2.5 px-3">Party</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Fulfilment Status</th>
                          <th className="py-2.5 px-3">Invoicing Status</th>
                          <th className="py-2.5 px-3 text-right">Grand Total</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {lists.orders
                          .filter((o) => o.type === (activeSection === "invoices" ? "SALES" : "PURCHASE"))
                          .map((o) => {
                            const isSales = o.type === "SALES";
                            const fStatus = o.fulfilmentStatus || (isSales ? "UNFULFILLED" : "UNRECEIVED");
                            const isFullyDone = isSales ? fStatus === "FULFILLED" : fStatus === "RECEIVED";
                            const isPartiallyDone = isSales ? fStatus === "PARTIALLY_FULFILLED" : fStatus === "PARTIALLY_RECEIVED";

                            return (
                              <tr key={o.id} className="hover:bg-zinc-800/30">
                                <td className="py-3 px-3 font-mono font-medium text-white">
                                  {o.orderNumber}
                                  <span className="block text-[10px] text-zinc-500">{o.itemsCount} line items</span>
                                </td>
                                <td className="py-3 px-3 text-zinc-300 font-medium">{o.partnerName || "Direct"}</td>
                                <td className="py-3 px-3 text-zinc-400">
                                  {new Date(o.orderDate).toLocaleDateString("en-IN")}
                                </td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                      isFullyDone
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : isPartiallyDone
                                        ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                    }`}
                                  >
                                    {fStatus}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                      o.invoicingStatus === "FULLY_INVOICED"
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : o.invoicingStatus === "PARTIALLY_INVOICED"
                                        ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                    }`}
                                  >
                                    {o.invoicingStatus || "UNINVOICED"}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right font-semibold text-white">
                                  {formatCurrency(o.grandTotal)}
                                </td>
                                <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                                  {isSales ? (
                                    <button
                                      disabled={isFullyDone}
                                      onClick={() => handleOpenFulfilmentModal(o.id)}
                                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                                        isFullyDone
                                          ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                                          : "bg-indigo-600 hover:bg-indigo-500 text-white"
                                      }`}
                                    >
                                      Fulfil Stock
                                    </button>
                                  ) : (
                                    <button
                                      disabled={isFullyDone}
                                      onClick={() => handleOpenReceivingModal(o.id)}
                                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                                        isFullyDone
                                          ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                                          : "bg-sky-600 hover:bg-sky-500 text-white"
                                      }`}
                                    >
                                      Receive Goods
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleOpenFulfilmentHistory(o.id)}
                                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium transition-colors border border-zinc-700"
                                  >
                                    History
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* INVOICES / BILLS TABLE VIEW */}
            {((activeSection === "invoices" && salesSubTab === "invoices") ||
              (activeSection === "expenses" && expensesSubTab === "bills")) && (
              <div className="space-y-4">
                {lists.invoices.filter((inv) => inv.type === (activeSection === "invoices" ? "SALES" : "PURCHASE")).length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-8">
                    No {activeSection === "invoices" ? "sales invoices" : "purchase bills"} recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-3">Invoice #</th>
                          <th className="py-2.5 px-3">Entity</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Grand Total</th>
                          <th className="py-2.5 px-3 text-right">Balance Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {lists.invoices
                          .filter((inv) => inv.type === (activeSection === "invoices" ? "SALES" : "PURCHASE"))
                          .map((inv) => (
                            <tr key={inv.id} className="hover:bg-zinc-800/30">
                              <td className="py-3 px-3 font-mono font-medium text-white">{inv.invoiceNumber}</td>
                              <td className="py-3 px-3 text-zinc-300">{inv.partnerName || "Direct"}</td>
                              <td className="py-3 px-3 text-zinc-400">{new Date(inv.invoiceDate).toLocaleDateString("en-IN")}</td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    inv.status === "PAID"
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : inv.status === "PARTIALLY_PAID"
                                      ? "bg-amber-500/20 text-amber-300"
                                      : "bg-zinc-800 text-zinc-300"
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-white">{formatCurrency(inv.grandTotal)}</td>
                              <td className="py-3 px-3 text-right font-bold text-amber-400">{formatCurrency(inv.balanceDue)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 6. PAYMENTS */}
        {activeSection === "payments" && (
          <div className="space-y-4">
            {lists.payments.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">No payment receipts logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Payment #</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Partner</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {lists.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-800/30">
                        <td className="py-3 px-3 font-mono font-medium text-white">{p.paymentNumber}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              p.type === "INCOMING" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {p.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-300 font-mono text-[11px]">{p.paymentMode}</td>
                        <td className="py-3 px-3 text-zinc-400 font-mono">{p.referenceNumber || "—"}</td>
                        <td className="py-3 px-3 text-zinc-200">{p.partnerName || "General"}</td>
                        <td className="py-3 px-3 text-zinc-500">{new Date(p.paymentDate).toLocaleDateString("en-IN")}</td>
                        <td className="py-3 px-3 font-bold text-emerald-400">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 7. GST PORTAL SUMMARY */}
        {activeSection === "gst" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Indian GST Compliance Summary
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                State Code: Gujarat (24) • Filing Slabs: 0%, 5%, 12%, 18%, 28%
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 space-y-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase">GSTR-1 (Outward Taxable Supplies)</span>
                <p className="text-xl font-bold text-white">{formatCurrency(metrics.totalRevenue)}</p>
                <p className="text-xs text-zinc-500">Total B2B & B2C Invoices Generated</p>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 space-y-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase">Input Tax Credit (ITC Potential)</span>
                <p className="text-xl font-bold text-cyan-400">{formatCurrency(metrics.totalExpenses * 0.18)}</p>
                <p className="text-xs text-zinc-500">Estimated eligible ITC across business purchases</p>
              </div>
            </div>
          </div>
        )}

        {/* 8. AUDIT LOGS */}
        {activeSection === "audit" && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Immutable Financial Audit Trail
            </h3>
            <div className="space-y-2">
              {recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] uppercase font-semibold">
                      {log.action}
                    </span>
                    <span className="text-zinc-200 font-medium">
                      {log.entity} <span className="text-zinc-500 font-mono text-[11px]">({log.entityId})</span>
                    </span>
                  </div>
                  <span className="text-zinc-500 font-mono text-[11px]">
                    {new Date(log.timestamp).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback for other planned business tabs */}
        {activeSection === "logistics" || activeSection === "reports" ? (
          <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
            <Layers className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-zinc-300 font-medium">Business Sub-Module: {activeSection.toUpperCase()}</p>
            <p>Ready for downstream expansion.</p>
          </div>
        ) : null}
      </div>

      {/* =========================================================================
          MODALS FOR BUSINESS CRUD
         ========================================================================= */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className={`w-full ${
              modalType === "fulfil_sales_order" ||
              modalType === "receive_purchase_order" ||
              modalType === "fulfilment_history"
                ? "max-w-3xl"
                : "max-w-md"
            } bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {modalType === "customer" && "Add New Customer"}
                {modalType === "vendor" && "Add New Supplier / Vendor"}
                {modalType === "product" && "Add Product / Service"}
                {modalType === "invoice" && "Create Invoice / Bill"}
                {modalType === "payment" && "Record Payment Receipt"}
                {modalType === "warehouse" && "Add New Warehouse"}
                {modalType === "stock_location" && "Add Stock Location"}
                {modalType === "stock_movement" && "Record Stock Movement"}
                {modalType === "order" &&
                  (orderForm.type === "SALES" ? "Create Sales Order" : "Create Purchase Order")}
                {modalType === "fulfil_sales_order" && "Fulfil Sales Order & Dispatch Stock"}
                {modalType === "receive_purchase_order" && "Receive Purchase Order & Inward Stock"}
                {modalType === "fulfilment_history" && "Fulfilment & Receipt History"}
              </h3>
              <button
                onClick={() => {
                  setModalType(null);
                  setFulfilmentDetails(null);
                  setFulfilmentHistory(null);
                }}
                className="text-zinc-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {formError}
              </div>
            )}

            {/* CUSTOMER FORM */}
            {modalType === "customer" && (
              <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Company / Customer Name *</label>
                  <input
                    required
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    placeholder="e.g. Acme Industries Ltd"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Email</label>
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Phone</label>
                    <input
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">GSTIN (15 chars)</label>
                    <input
                      value={customerForm.gstin}
                      onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value })}
                      placeholder="24AAAAA0000A1Z5"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">State Code</label>
                    <input
                      value={customerForm.stateCode}
                      onChange={(e) => setCustomerForm({ ...customerForm, stateCode: e.target.value })}
                      placeholder="24"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-colors"
                >
                  {isPending ? "Saving..." : "Save Customer"}
                </button>
              </form>
            )}

            {/* VENDOR FORM */}
            {modalType === "vendor" && (
              <form onSubmit={handleCreateVendor} className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Supplier Name *</label>
                  <input
                    required
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    placeholder="e.g. Apex Hardware Supplies"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Email</label>
                    <input
                      type="email"
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">GSTIN</label>
                    <input
                      value={vendorForm.gstin}
                      onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
                      placeholder="24BBBBB1111B1Z2"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-colors"
                >
                  {isPending ? "Saving..." : "Save Supplier"}
                </button>
              </form>
            )}

            {/* PRODUCT FORM */}
            {modalType === "product" && (
              <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Product / Service Name *</label>
                  <input
                    required
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    placeholder="e.g. Enterprise Cloud License"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">SKU</label>
                    <input
                      value={productForm.sku}
                      onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                      placeholder="SKU-1001"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Type</label>
                    <select
                      value={productForm.type}
                      onChange={(e) => setProductForm({ ...productForm, type: e.target.value as "PRODUCT" | "SERVICE" })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value="PRODUCT">Product</option>
                      <option value="SERVICE">Service</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">HSN/SAC Code</label>
                    <input
                      value={productForm.hsnSacCode}
                      onChange={(e) => setProductForm({ ...productForm, hsnSacCode: e.target.value })}
                      placeholder="998314"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Unit</label>
                    <input
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value.toUpperCase() })}
                      placeholder="NOS / PCS / KG"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Cost Price (₹)</label>
                    <input
                      type="number"
                      value={productForm.purchasePrice}
                      onChange={(e) => setProductForm({ ...productForm, purchasePrice: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Selling Price (₹)</label>
                    <input
                      type="number"
                      value={productForm.sellingPrice}
                      onChange={(e) => setProductForm({ ...productForm, sellingPrice: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="trackInventory"
                    checked={productForm.trackInventory}
                    onChange={(e) => setProductForm({ ...productForm, trackInventory: e.target.checked })}
                    className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-0"
                  />
                  <label htmlFor="trackInventory" className="text-zinc-300 cursor-pointer">
                    Track Inventory (Movements & Ledger Balances)
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-colors"
                >
                  {isPending ? "Saving..." : "Save Product/Service"}
                </button>
              </form>
            )}

            {/* INVOICE FORM */}
            {modalType === "invoice" && (
              <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Type</label>
                    <select
                      value={invoiceForm.type}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, type: e.target.value as "SALES" | "PURCHASE" })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value="SALES">Sales Invoice</option>
                      <option value="PURCHASE">Purchase Bill</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Entity</label>
                    {invoiceForm.type === "SALES" ? (
                      <select
                        value={invoiceForm.customerId}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, customerId: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                      >
                        {lists.customers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={invoiceForm.vendorId}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, vendorId: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                      >
                        {lists.vendors.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Line Item Description</label>
                  <input
                    required
                    value={invoiceForm.description}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Qty</label>
                    <input
                      type="number"
                      value={invoiceForm.quantity}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, quantity: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Unit Price (₹)</label>
                    <input
                      type="number"
                      value={invoiceForm.unitPrice}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, unitPrice: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">GST Rate</label>
                    <select
                      value={invoiceForm.gstRate}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, gstRate: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-colors"
                >
                  {isPending ? "Generating..." : "Generate Invoice with GST"}
                </button>
              </form>
            )}

            {/* PAYMENT FORM */}
            {modalType === "payment" && (
              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Target Invoice (Balance Due)</label>
                  <select
                    value={paymentForm.invoiceId}
                    onChange={(e) => {
                      const inv = lists.invoices.find((i) => i.id === e.target.value);
                      setPaymentForm({
                        ...paymentForm,
                        invoiceId: e.target.value,
                        amount: inv?.balanceDue || 1000,
                      });
                    }}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                  >
                    {lists.invoices
                      .filter((i) => i.balanceDue > 0)
                      .map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} - Due: ₹{inv.balanceDue} ({inv.partnerName})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Amount to Pay (₹)</label>
                    <input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Payment Mode</label>
                    <select
                      value={paymentForm.paymentMode}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Reference / UTR Number</label>
                  <input
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-colors"
                >
                  {isPending ? "Recording..." : "Record Payment & Settle Balance"}
                </button>
              </form>
            )}

            {/* WAREHOUSE FORM */}
            {modalType === "warehouse" && (
              <form onSubmit={handleCreateWarehouse} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Warehouse Name *</label>
                    <input
                      required
                      value={warehouseForm.name}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                      placeholder="e.g. Central Warehouse Mumbai"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Warehouse Code *</label>
                    <input
                      required
                      value={warehouseForm.code}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. WH-BOM-01"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Facility Address</label>
                  <input
                    value={warehouseForm.address}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                    placeholder="Plot 42, Logistics Park, Bhiwandi"
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Contact Phone</label>
                    <input
                      value={warehouseForm.contactPhone}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, contactPhone: e.target.value })}
                      placeholder="+91 98200 12345"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={warehouseForm.contactEmail}
                      onChange={(e) => setWarehouseForm({ ...warehouseForm, contactEmail: e.target.value })}
                      placeholder="warehouse@company.com"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-colors"
                >
                  {isPending ? "Creating..." : "Save Warehouse"}
                </button>
              </form>
            )}

            {/* STOCK LOCATION FORM */}
            {modalType === "stock_location" && (
              <form onSubmit={handleCreateStockLocation} className="space-y-3 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Parent Warehouse *</label>
                  <select
                    required
                    value={locationForm.warehouseId}
                    onChange={(e) => setLocationForm({ ...locationForm, warehouseId: e.target.value })}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  >
                    <option value="" disabled>Select Warehouse</option>
                    {lists.warehouses?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Location Name *</label>
                    <input
                      required
                      value={locationForm.name}
                      onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                      placeholder="e.g. Aisle 1 Rack B"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Location Code *</label>
                    <input
                      required
                      value={locationForm.code}
                      onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. LOC-A1-B"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Description / Notes</label>
                  <input
                    value={locationForm.description}
                    onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })}
                    placeholder="Temperature controlled storage bin"
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isPending || !lists.warehouses?.length}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-colors disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Save Stock Location"}
                </button>
              </form>
            )}

            {/* STOCK MOVEMENT FORM */}
            {modalType === "stock_movement" && (
              <form onSubmit={handleRecordStockMovement} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Movement Type</label>
                    <select
                      value={movementForm.type}
                      onChange={(e) => {
                        const newType = e.target.value as "INCOMING" | "OUTGOING" | "TRANSFER" | "ADJUSTMENT";
                        setMovementForm({ ...movementForm, type: newType });
                      }}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-medium"
                    >
                      <option value="INCOMING">INCOMING (Goods Receipt / Inflow)</option>
                      <option value="OUTGOING">OUTGOING (Stock Issue / Dispatch)</option>
                      <option value="TRANSFER">TRANSFER (Inter-Location Transfer)</option>
                      <option value="ADJUSTMENT">ADJUSTMENT (Count Reconciliation)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Product Item *</label>
                    <select
                      required
                      value={movementForm.productId}
                      onChange={(e) => setMovementForm({ ...movementForm, productId: e.target.value })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value="" disabled>Select Item</option>
                      {lists.products
                        .filter((p) => p.trackInventory !== false)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ""} - On Hand: {getProductStock(p.id)} {p.unit}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Location Selection based on Type */}
                {movementForm.type === "INCOMING" && (
                  <div>
                    <label className="text-zinc-400 block mb-1">Destination Storage Location *</label>
                    <select
                      required
                      value={movementForm.destinationLocationId}
                      onChange={(e) => setMovementForm({ ...movementForm, destinationLocationId: e.target.value })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    >
                      <option value="" disabled>Select Storage Location</option>
                      {lists.stockLocations?.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.warehouseName} → {loc.name} ({loc.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {movementForm.type === "OUTGOING" && (
                  <div>
                    <label className="text-zinc-400 block mb-1">Source Storage Location *</label>
                    <select
                      required
                      value={movementForm.sourceLocationId}
                      onChange={(e) => setMovementForm({ ...movementForm, sourceLocationId: e.target.value })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    >
                      <option value="" disabled>Select Source Location</option>
                      {lists.stockLocations?.map((loc) => {
                        const stockAtLoc = getLocationStock(movementForm.productId, loc.id);
                        return (
                          <option key={loc.id} value={loc.id}>
                            {loc.warehouseName} → {loc.name} ({loc.code}) [Available: {stockAtLoc}]
                          </option>
                        );
                      })}
                    </select>
                    {movementForm.sourceLocationId && (
                      <span className="text-[11px] text-zinc-400 mt-1 block">
                        Available at selected location:{" "}
                        <strong className="text-amber-400">
                          {getLocationStock(movementForm.productId, movementForm.sourceLocationId)}
                        </strong>{" "}
                        units
                      </span>
                    )}
                  </div>
                )}

                {movementForm.type === "TRANSFER" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-zinc-400 block mb-1">Source Location *</label>
                      <select
                        required
                        value={movementForm.sourceLocationId}
                        onChange={(e) => setMovementForm({ ...movementForm, sourceLocationId: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-[11px]"
                      >
                        <option value="" disabled>Select Source</option>
                        {lists.stockLocations?.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} ({loc.code}) [Avail: {getLocationStock(movementForm.productId, loc.id)}]
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-zinc-400 block mb-1">Destination Location *</label>
                      <select
                        required
                        value={movementForm.destinationLocationId}
                        onChange={(e) => setMovementForm({ ...movementForm, destinationLocationId: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-[11px]"
                      >
                        <option value="" disabled>Select Destination</option>
                        {lists.stockLocations?.map((loc) => (
                          <option key={loc.id} value={loc.id} disabled={loc.id === movementForm.sourceLocationId}>
                            {loc.name} ({loc.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {movementForm.type === "ADJUSTMENT" && (
                  <div>
                    <label className="text-zinc-400 block mb-1">Target Storage Location *</label>
                    <select
                      required
                      value={movementForm.sourceLocationId}
                      onChange={(e) => setMovementForm({ ...movementForm, sourceLocationId: e.target.value })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    >
                      <option value="" disabled>Select Location</option>
                      {lists.stockLocations?.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.warehouseName} → {loc.name} ({loc.code}) [Current: {getLocationStock(movementForm.productId, loc.id)}]
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">
                      {movementForm.type === "ADJUSTMENT" ? "Adjustment Delta (+ / -)" : "Quantity *"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm({ ...movementForm, quantity: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Reference Number</label>
                    <input
                      value={movementForm.referenceNumber}
                      onChange={(e) => setMovementForm({ ...movementForm, referenceNumber: e.target.value })}
                      placeholder="e.g. PO-8821 / DC-09"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">
                    {movementForm.type === "ADJUSTMENT" ? "Reason for Adjustment * (Required for Audit)" : "Notes / Purpose"}
                  </label>
                  <input
                    required={movementForm.type === "ADJUSTMENT"}
                    value={movementForm.reason}
                    onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                    placeholder={movementForm.type === "ADJUSTMENT" ? "e.g. Annual physical inventory count discrepancy" : "e.g. Initial warehouse stocking"}
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending || !movementForm.productId || (movementForm.type !== "ADJUSTMENT" && movementForm.quantity <= 0)}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition-colors disabled:opacity-50"
                >
                  {isPending ? "Executing Transaction..." : "Record Movement & Update Balances"}
                </button>
              </form>
            )}

            {/* ORDER FORM */}
            {modalType === "order" && (
              <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Order Type</label>
                    <select
                      value={orderForm.type}
                      onChange={(e) =>
                        setOrderForm({
                          ...orderForm,
                          type: e.target.value as "SALES" | "PURCHASE",
                        })
                      }
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value="SALES">Sales Order (Customer)</option>
                      <option value="PURCHASE">Purchase Order (Supplier)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">
                      {orderForm.type === "SALES" ? "Customer *" : "Supplier / Vendor *"}
                    </label>
                    {orderForm.type === "SALES" ? (
                      <select
                        required
                        value={orderForm.customerId}
                        onChange={(e) => setOrderForm({ ...orderForm, customerId: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                      >
                        <option value="" disabled>Select Customer</option>
                        {lists.customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.stateCode ? `State ${c.stateCode}` : "No State"})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        required
                        value={orderForm.vendorId}
                        onChange={(e) => setOrderForm({ ...orderForm, vendorId: e.target.value })}
                        className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                      >
                        <option value="" disabled>Select Vendor</option>
                        {lists.vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.stateCode ? `State ${v.stateCode}` : "No State"})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Item Description *</label>
                  <input
                    required
                    value={orderForm.description}
                    onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })}
                    placeholder="e.g. Server Rack Equipment / Maintenance Service"
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">HSN/SAC Code</label>
                    <input
                      value={orderForm.hsnSacCode}
                      onChange={(e) => setOrderForm({ ...orderForm, hsnSacCode: e.target.value })}
                      placeholder="8471"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Place of Supply (State)</label>
                    <input
                      value={orderForm.placeOfSupply}
                      onChange={(e) => setOrderForm({ ...orderForm, placeOfSupply: e.target.value })}
                      placeholder="24"
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-zinc-400 block mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={orderForm.quantity}
                      onChange={(e) => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Unit Price (₹) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={orderForm.unitPrice}
                      onChange={(e) => setOrderForm({ ...orderForm, unitPrice: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">GST Rate (%)</label>
                    <select
                      value={orderForm.gstRate}
                      onChange={(e) => setOrderForm({ ...orderForm, gstRate: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Order Notes / References</label>
                  <input
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                    placeholder="e.g. PO reference / Project Alpha delivery"
                    className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-colors"
                >
                  {isPending ? "Creating..." : `Save ${orderForm.type === "SALES" ? "Sales" : "Purchase"} Order`}
                </button>
              </form>
            )}

            {/* SALES FULFILMENT MODAL */}
            {modalType === "fulfil_sales_order" && (
              <form onSubmit={handleSubmitSalesFulfilment} className="space-y-4 text-xs">
                {!fulfilmentDetails ? (
                  <div className="py-8 text-center text-zinc-500">Loading order items and warehouse stock...</div>
                ) : (
                  <>
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="font-mono text-zinc-200 font-semibold">{fulfilmentDetails.order.orderNumber}</div>
                        <div className="text-zinc-400 text-[11px]">{fulfilmentDetails.order.customer?.name || "Customer"}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {fulfilmentDetails.order.fulfilmentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="font-semibold text-zinc-300">Items to Fulfil & Dispatch</div>
                      {fulfilmentDetails.items.map((item) => {
                        const formItem = fulfilmentItemsForm.find((fi) => fi.orderItemId === item.orderItemId);
                        const selectedLocationId = formItem?.locationId || "";
                        const selectedLocStock = item.availableStockByLocation?.find(
                          (l) => l.locationId === selectedLocationId
                        )?.availableStock ?? 0;
                        const isFullyFulfilled = item.remainingQuantity <= 0;

                        return (
                          <div
                            key={item.orderItemId}
                            className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-medium text-zinc-200">{item.description}</span>
                                {item.isTrackedInventory ? (
                                  <span className="ml-2 px-1.5 py-0.5 text-[9px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Tracked Stock
                                  </span>
                                ) : (
                                  <span className="ml-2 px-1.5 py-0.5 text-[9px] rounded bg-zinc-800 text-zinc-400">
                                    Service / Untracked
                                  </span>
                                )}
                              </div>
                              <div className="text-right font-mono text-[11px]">
                                <span className="text-zinc-400">Ordered: {item.orderedQuantity}</span>
                                <span className="text-emerald-400 ml-2">Fulfilled: {item.fulfilledQuantity}</span>
                                <span className="text-amber-400 ml-2">Remaining: {item.remainingQuantity}</span>
                              </div>
                            </div>

                            {isFullyFulfilled ? (
                              <div className="text-[11px] text-emerald-400 font-mono py-1">✓ Completely Fulfilled</div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-zinc-850">
                                {item.isTrackedInventory ? (
                                  <div>
                                    <label className="text-zinc-400 block mb-1">Source Stock Location *</label>
                                    <select
                                      required
                                      value={selectedLocationId}
                                      onChange={(e) => {
                                        const newLocId = e.target.value;
                                        setFulfilmentItemsForm((prev) =>
                                          prev.map((fi) =>
                                            fi.orderItemId === item.orderItemId
                                              ? { ...fi, locationId: newLocId }
                                              : fi
                                          )
                                        );
                                      }}
                                      className="w-full p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-[11px]"
                                    >
                                      <option value="" disabled>Select Location</option>
                                      {item.availableStockByLocation?.map((loc) => (
                                        <option key={loc.locationId} value={loc.locationId}>
                                          {loc.warehouseName} → {loc.locationName} ({loc.locationCode}) [Avail: {loc.availableStock}]
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="flex items-center text-zinc-400 text-[11px]">
                                    Service/non-inventory: No warehouse decrement required.
                                  </div>
                                )}

                                <div>
                                  <label className="text-zinc-400 block mb-1">
                                    Quantity to Fulfil
                                    {item.isTrackedInventory && (
                                      <span className="text-zinc-500 ml-1">
                                        (Avail in Loc: {selectedLocStock})
                                      </span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.remainingQuantity}
                                    step="any"
                                    value={formItem?.quantity ?? 0}
                                    onChange={(e) => {
                                      const val = Math.max(0, Number(e.target.value));
                                      setFulfilmentItemsForm((prev) =>
                                        prev.map((fi) =>
                                          fi.orderItemId === item.orderItemId
                                            ? { ...fi, quantity: val }
                                            : fi
                                        )
                                      );
                                    }}
                                    className="w-full p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-[11px]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div>
                      <label className="text-zinc-400 block mb-1">Fulfilment Dispatch Notes / Waybill</label>
                      <input
                        value={fulfilmentNotes}
                        onChange={(e) => setFulfilmentNotes(e.target.value)}
                        placeholder="e.g. Dispatched via Express Logistics AWB #998821"
                        className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isPending || fulfilmentItemsForm.every((it) => it.quantity <= 0)}
                      className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition-colors disabled:opacity-50"
                    >
                      {isPending ? "Dispatching & Updating Ledger..." : "Confirm Fulfilment & Dispatch Stock"}
                    </button>
                  </>
                )}
              </form>
            )}

            {/* PURCHASE RECEIVING MODAL */}
            {modalType === "receive_purchase_order" && (
              <form onSubmit={handleSubmitPurchaseReceipt} className="space-y-4 text-xs">
                {!fulfilmentDetails ? (
                  <div className="py-8 text-center text-zinc-500">Loading order items and destination locations...</div>
                ) : (
                  <>
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="font-mono text-zinc-200 font-semibold">{fulfilmentDetails.order.orderNumber}</div>
                        <div className="text-zinc-400 text-[11px]">{fulfilmentDetails.order.vendor?.name || "Supplier"}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {fulfilmentDetails.order.fulfilmentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="font-semibold text-zinc-300">Items to Receive & Inward</div>
                      {fulfilmentDetails.items.map((item) => {
                        const formItem = fulfilmentItemsForm.find((fi) => fi.orderItemId === item.orderItemId);
                        const selectedLocationId = formItem?.locationId || "";

                        return (
                          <div
                            key={item.orderItemId}
                            className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-medium text-zinc-200">{item.description}</span>
                                {item.isTrackedInventory ? (
                                  <span className="ml-2 px-1.5 py-0.5 text-[9px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Stock Inventory
                                  </span>
                                ) : (
                                  <span className="ml-2 px-1.5 py-0.5 text-[9px] rounded bg-zinc-800 text-zinc-400">
                                    Service / Expense
                                  </span>
                                )}
                              </div>
                              <div className="text-right font-mono text-[11px]">
                                <span className="text-zinc-400">Ordered: {item.orderedQuantity}</span>
                                <span className="text-emerald-400 ml-2">Received: {item.receivedQuantity}</span>
                                <span className="text-amber-400 ml-2">Remaining: {item.remainingQuantity}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-zinc-850">
                              {item.isTrackedInventory ? (
                                <div>
                                  <label className="text-zinc-400 block mb-1">Destination Storage Location *</label>
                                  <select
                                    required
                                    value={selectedLocationId}
                                    onChange={(e) => {
                                      const newLocId = e.target.value;
                                      setFulfilmentItemsForm((prev) =>
                                        prev.map((fi) =>
                                          fi.orderItemId === item.orderItemId
                                            ? { ...fi, locationId: newLocId }
                                            : fi
                                        )
                                      );
                                    }}
                                    className="w-full p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-[11px]"
                                  >
                                    <option value="" disabled>Select Location</option>
                                    {fulfilmentDetails.locations?.map((loc) => (
                                      <option key={loc.id} value={loc.id}>
                                        {loc.warehouseName} → {loc.name} ({loc.code})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div className="flex items-center text-zinc-400 text-[11px]">
                                  Service item: Goods receipt marked without physical stock increment.
                                </div>
                              )}

                              <div>
                                <label className="text-zinc-400 block mb-1">Quantity to Receive</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={formItem?.quantity ?? 0}
                                  onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value));
                                    setFulfilmentItemsForm((prev) =>
                                      prev.map((fi) =>
                                        fi.orderItemId === item.orderItemId
                                          ? { ...fi, quantity: val }
                                          : fi
                                      )
                                    );
                                  }}
                                  className="w-full p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-[11px]"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                      <input
                        type="checkbox"
                        id="allowOverReceipt"
                        checked={allowOverReceipt}
                        onChange={(e) => setAllowOverReceipt(e.target.checked)}
                        className="rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-0"
                      />
                      <label htmlFor="allowOverReceipt" className="text-zinc-300 cursor-pointer select-none">
                        Authorize over-receipt (permit receiving more than original purchase order quantity)
                      </label>
                    </div>

                    <div>
                      <label className="text-zinc-400 block mb-1">Receipt / Inward Delivery Challan Notes</label>
                      <input
                        value={fulfilmentNotes}
                        onChange={(e) => setFulfilmentNotes(e.target.value)}
                        placeholder="e.g. Vendor DC #5521 received in good condition"
                        className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isPending || fulfilmentItemsForm.every((it) => it.quantity <= 0)}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition-colors disabled:opacity-50"
                    >
                      {isPending ? "Inwarding Goods..." : "Confirm Goods Receipt & Inward Stock"}
                    </button>
                  </>
                )}
              </form>
            )}

            {/* FULFILMENT HISTORY MODAL */}
            {modalType === "fulfilment_history" && (
              <div className="space-y-4 text-xs">
                {!fulfilmentHistory ? (
                  <div className="py-8 text-center text-zinc-500">Loading fulfilment records...</div>
                ) : fulfilmentHistory.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 space-y-1">
                    <History className="w-8 h-8 mx-auto text-zinc-600" />
                    <div>No fulfilment or receipt records found for this order.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fulfilmentHistory.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-white">
                              {rec.fulfilmentNumber}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                                rec.type === "SALES_FULFILMENT"
                                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              {rec.type === "SALES_FULFILMENT" ? "Sales Dispatch" : "Purchase Receipt"}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {new Date(rec.createdAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {rec.notes && (
                          <div className="text-[11px] text-zinc-400 italic">
                            Note: {rec.notes}
                          </div>
                        )}

                        <div className="border-t border-zinc-850 pt-2 space-y-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                            Dispatched / Received Items
                          </div>
                          {rec.items.map((it) => (
                            <div
                              key={it.id}
                              className="flex items-center justify-between text-[11px] p-1.5 rounded bg-zinc-900 border border-zinc-850"
                            >
                              <div>
                                <span className="text-zinc-200 font-medium">
                                  {it.orderItem?.description || "Item"}
                                </span>
                                {it.location && (
                                  <span className="text-zinc-400 text-[10px] ml-2">
                                    at {it.location.warehouse?.name} → {it.location.name} ({it.location.code})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="font-semibold text-white">Qty: {it.quantity}</span>
                                {it.stockMovement && (
                                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded border border-indigo-500/20">
                                    {it.stockMovement.movementNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="text-[10px] text-zinc-500 flex justify-between pt-1">
                          <span>Recorded by: {rec.user?.name || "System"}</span>
                          <span className="uppercase">{rec.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
