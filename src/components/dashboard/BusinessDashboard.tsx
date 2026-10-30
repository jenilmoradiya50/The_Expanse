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
} from "@/lib/actions";

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
      }>;
      orders: Array<{
        id: string;
        orderNumber: string;
        type: string;
        status: string;
        partnerName?: string | null;
        orderDate: string;
        grandTotal: number;
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
              <button
                onClick={() => setModalType("product")}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Product/Service
              </button>
            )}

            {(activeSection === "invoices" || activeSection === "expenses") && (
              <button
                onClick={() => setModalType("invoice")}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Invoice / Bill
              </button>
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

        {/* 4. INVENTORY / PRODUCTS & SERVICES */}
        {activeSection === "inventory" && (
          <div className="space-y-4">
            {lists.products.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-500">
                <Package className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                No products or services registered yet. Click &quot;Add Product/Service&quot; to register catalog items.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">HSN/SAC</th>
                      <th className="py-2.5 px-3">GST Rate</th>
                      <th className="py-2.5 px-3">Selling Price</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {lists.products.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-800/30">
                        <td className="py-3 px-3 font-medium text-white">{p.name}</td>
                        <td className="py-3 px-3 font-mono text-zinc-400">{p.sku || "—"}</td>
                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300">
                            {p.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-300">{p.hsnSacCode}</td>
                        <td className="py-3 px-3 text-zinc-300">{p.gstRate}%</td>
                        <td className="py-3 px-3 font-semibold text-emerald-400">{formatCurrency(p.sellingPrice)}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              startTransition(async () => {
                                await archiveProductAction(organization.id, p.id);
                              });
                            }}
                            className="text-zinc-500 hover:text-red-400 p-1 rounded"
                            title="Archive Product"
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

        {/* 5. INVOICES & PURCHASES */}
        {(activeSection === "invoices" || activeSection === "expenses") && (
          <div className="space-y-4">
            {lists.invoices.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-8">No invoices recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Entity</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Grand Total</th>
                      <th className="py-2.5 px-3">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {lists.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-zinc-800/30">
                        <td className="py-3 px-3 font-mono font-medium text-white">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              inv.type === "SALES" ? "bg-emerald-500/10 text-emerald-400" : "bg-purple-500/10 text-purple-400"
                            }`}
                          >
                            {inv.type}
                          </span>
                        </td>
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
                        <td className="py-3 px-3 font-semibold text-white">{formatCurrency(inv.grandTotal)}</td>
                        <td className="py-3 px-3 font-bold text-amber-400">{formatCurrency(inv.balanceDue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {modalType === "customer" && "Add New Customer"}
                {modalType === "vendor" && "Add New Supplier / Vendor"}
                {modalType === "product" && "Add Product / Service"}
                {modalType === "invoice" && "Create Invoice / Bill"}
                {modalType === "payment" && "Record Payment Receipt"}
              </h3>
              <button
                onClick={() => setModalType(null)}
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
                    <label className="text-zinc-400 block mb-1">Selling Price (₹)</label>
                    <input
                      type="number"
                      value={productForm.sellingPrice}
                      onChange={(e) => setProductForm({ ...productForm, sellingPrice: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
