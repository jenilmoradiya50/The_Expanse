"use client";

import { useState } from "react";
import { Sidebar, type WorkspaceMode } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BusinessDashboard } from "../dashboard/BusinessDashboard";
import { PersonalDashboard } from "../dashboard/PersonalDashboard";
import { FutureModulePlaceholder } from "../dashboard/FutureModulePlaceholder";
import type { AuthenticatedUser } from "@/lib/session";
import type { RoleType } from "@/types";

interface ShellProps {
  user: AuthenticatedUser;
  currentOrg: {
    id: string;
    name: string;
    slug: string;
    role: RoleType;
    currency: string;
    gstin?: string | null;
  };
  availableOrgs: Array<{
    id: string;
    name: string;
    slug: string;
    role: RoleType;
    isDefault: boolean;
    gstin: string | null;
  }>;
  securityNotice?: string;
  businessData: {
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
  personalData: {
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
}

export function Shell({
  user,
  currentOrg,
  availableOrgs,
  securityNotice,
  businessData,
  personalData,
}: ShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("business");
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentOrg={currentOrg}
        availableOrgs={availableOrgs}
        workspaceMode={workspaceMode}
        onWorkspaceModeChange={setWorkspaceMode}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main App Container */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        {/* Topbar */}
        <Topbar
          user={user}
          currentOrg={currentOrg}
          workspaceMode={workspaceMode}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          securityNotice={securityNotice}
        />

        {/* Dashboard Dynamic Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {workspaceMode === "business" && (
            <BusinessDashboard data={businessData} activeSection={activeSection} />
          )}

          {workspaceMode === "personal" && (
            <PersonalDashboard data={personalData} activeSection={activeSection} />
          )}

          {workspaceMode === "future" && <FutureModulePlaceholder />}
        </main>
      </div>
    </div>
  );
}
