"use client";

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
  FileCheck2,
} from "lucide-react";

interface BusinessMetricsProps {
  data: {
    organization: {
      id: string;
      name: string;
      slug: string;
      role: string;
    };
    metrics: {
      totalIncome: number;
      totalExpenses: number;
      netProfit: number;
      outstandingReceivables: number;
      invoicesCount: number;
      expensesCount: number;
      customersCount: number;
      vendorsCount: number;
      isDemoDataNotice: string;
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

export function BusinessDashboard({ data, activeSection }: BusinessMetricsProps) {
  const { organization, metrics, recentActivity } = data;

  // Format currency in Indian Rupees
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Development Banner */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
        <div>
          <span className="font-semibold uppercase tracking-wider text-[11px] block">
            Development Mode Notice:
          </span>
          <p className="text-zinc-300 mt-0.5">
            {metrics.isDemoDataNotice} All calculations are executed via Decimal arithmetic.
          </p>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Total Income
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(metrics.totalIncome)}
            </h3>
            <span className="text-[11px] text-zinc-500 mt-1 block">
              [DEMO SAMPLE DATA] Collected revenue
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Total Expenses
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
              [DEMO SAMPLE DATA] Recorded bills
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
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(metrics.netProfit)}
            </h3>
            <span className="text-[11px] text-zinc-500 mt-1 block">
              [DEMO SAMPLE DATA] Operating balance
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Receivables
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(metrics.outstandingReceivables)}
            </h3>
            <span className="text-[11px] text-zinc-500 mt-1 block">
              [DEMO SAMPLE DATA] Outstanding balance
            </span>
          </div>
        </div>
      </div>

      {/* Operational Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="text-lg font-bold text-zinc-100">{metrics.invoicesCount}</span>
            <span className="text-xs text-zinc-400 block">Total Invoices</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <span className="text-lg font-bold text-zinc-100">{metrics.expensesCount}</span>
            <span className="text-xs text-zinc-400 block">Expenses Logged</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-lg font-bold text-zinc-100">{metrics.customersCount}</span>
            <span className="text-xs text-zinc-400 block">Clients & Customers</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <span className="text-lg font-bold text-zinc-100">{metrics.vendorsCount}</span>
            <span className="text-xs text-zinc-400 block">Vendors & Suppliers</span>
          </div>
        </div>
      </div>

      {/* Main Section Dynamic Content */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white capitalize">
              Business: {activeSection.replace("-", " ")}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Current organization: <span className="text-zinc-200 font-medium">{organization.name}</span> ({organization.role})
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
            Tenant Isolated
          </span>
        </div>

        {activeSection === "overview" ? (
          <div className="pt-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Recent Tenant Audit Activity
            </h3>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-zinc-500">No recent audit history recorded.</p>
            ) : (
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
            )}
          </div>
        ) : (
          <div className="py-12 text-center space-y-3">
            <FileCheck2 className="w-10 h-10 text-zinc-600 mx-auto" />
            <h4 className="text-sm font-medium text-zinc-300">
              {activeSection.toUpperCase()} Workspace Section Ready
            </h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              This business module is linked directly to {organization.name}. Form inputs and ledger tables will connect in Phase 4.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
