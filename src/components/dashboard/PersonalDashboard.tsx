"use client";

import { Wallet, CreditCard, PiggyBank, ArrowDownRight, ArrowUpRight, ShieldCheck } from "lucide-react";

interface PersonalMetricsProps {
  data: {
    user: {
      id: string;
      name: string;
      email: string;
    };
    metrics: {
      totalLiquidAssets: number;
      totalLiabilities: number;
      netWorth: number;
      accountsCount: number;
      categoriesCount: number;
      transactionsCount: number;
      budgetsCount: number;
      isDemoDataNotice: string;
    };
    accounts: Array<{
      id: string;
      name: string;
      type: string;
      balance: number;
      currency: string;
      last4?: string | null;
    }>;
    recentTransactions: Array<{
      id: string;
      type: string;
      amount: number;
      date: string;
      payee: string;
      category: string;
      account: string;
    }>;
  };
  activeSection: string;
}

export function PersonalDashboard({ data, activeSection }: PersonalMetricsProps) {
  const { user, metrics, accounts, recentTransactions } = data;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Isolation Notice */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">
        <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-400" />
        <div>
          <span className="font-semibold uppercase tracking-wider text-[11px] block">
            Personal Domain Isolation:
          </span>
          <p className="text-zinc-300 mt-0.5">
            {metrics.isDemoDataNotice} Records in this workspace are strictly scoped to {user.name} and cannot be seen by organization members.
          </p>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Total Net Worth
          </span>
          <h3 className="text-2xl font-bold text-white tracking-tight mt-2">
            {formatCurrency(metrics.netWorth)}
          </h3>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            [DEMO DATA] Assets minus liabilities
          </span>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Liquid Assets
          </span>
          <h3 className="text-2xl font-bold text-emerald-400 tracking-tight mt-2">
            {formatCurrency(metrics.totalLiquidAssets)}
          </h3>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Bank accounts & cash wallets
          </span>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Liabilities / Credit
          </span>
          <h3 className="text-2xl font-bold text-rose-400 tracking-tight mt-2">
            {formatCurrency(metrics.totalLiabilities)}
          </h3>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            Credit cards & payables
          </span>
        </div>
      </div>

      {/* Accounts Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300 truncate">{acc.name}</span>
              {acc.type === "CREDIT_CARD" ? (
                <CreditCard className="w-4 h-4 text-rose-400" />
              ) : acc.type === "SAVINGS" ? (
                <PiggyBank className="w-4 h-4 text-emerald-400" />
              ) : (
                <Wallet className="w-4 h-4 text-cyan-400" />
              )}
            </div>
            <p className="text-lg font-bold text-white">
              {formatCurrency(acc.balance)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/60">
              <span className="uppercase text-[10px] tracking-wider">{acc.type}</span>
              {acc.last4 && <span>Ending in •••• {acc.last4}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Section View */}
      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-white capitalize">
              Personal Finance: {activeSection.replace("-", " ")}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Owner: <span className="text-zinc-200 font-medium">{user.name}</span> ({user.email})
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            User Scoped
          </span>
        </div>

        <div className="pt-6">
          {recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No transactions recorded in this period. Use the Personal module to log expenses or link business reimbursements.
            </div>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        tx.type === "INCOME"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {tx.type === "INCOME" ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <span className="text-zinc-200 font-medium block">{tx.payee}</span>
                      <span className="text-zinc-500 text-[11px]">
                        {tx.category} • {tx.account}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`font-semibold ${
                      tx.type === "INCOME" ? "text-emerald-400" : "text-zinc-200"
                    }`}
                  >
                    {tx.type === "INCOME" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
