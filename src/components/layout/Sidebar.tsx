"use client";

import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Users,
  Building,
  Package,
  Truck,
  Landmark,
  FileSpreadsheet,
  History,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Sparkles,
  Briefcase,
  UserCheck,
  X,
} from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import type { RoleType } from "@/types";

export type WorkspaceMode = "business" | "personal" | "future";

interface SidebarProps {
  currentOrg: {
    id: string;
    name: string;
    slug: string;
    role: RoleType;
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
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  currentOrg,
  availableOrgs,
  workspaceMode,
  onWorkspaceModeChange,
  activeSection,
  onSectionChange,
  isOpen,
  onClose,
}: SidebarProps) {
  // Business Navigation Items
  const businessNav = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "invoices", label: "Invoices & Sales", icon: Receipt },
    { id: "expenses", label: "Purchases & Expenses", icon: CreditCard },
    { id: "customers", label: "Customers & Clients", icon: Users },
    { id: "vendors", label: "Vendors & Suppliers", icon: Building },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "logistics", label: "Logistics", icon: Truck },
    { id: "payments", label: "Payments", icon: Landmark },
    { id: "gst", label: "GST Compliance", icon: FileSpreadsheet },
    { id: "reports", label: "Financial Reports", icon: PieChart },
    { id: "audit", label: "Audit Logs", icon: History },
  ];

  // Personal Finance Navigation Items
  const personalNav = [
    { id: "overview", label: "Personal Dashboard", icon: LayoutDashboard },
    { id: "accounts", label: "Bank & Cards", icon: Wallet },
    { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
    { id: "budgets", label: "Budgets & Slabs", icon: PieChart },
    { id: "reports", label: "Net Worth Reports", icon: FileSpreadsheet },
  ];

  const handleNavClick = (sectionId: string) => {
    onSectionChange(sectionId);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-zinc-950 border-r border-zinc-800/80 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* App Title Header */}
        <div className="h-16 px-5 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-emerald-500/10">
              E
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">
                The Expanse
              </span>
              <span className="text-[10px] text-zinc-500 block -mt-0.5">
                Financial Ecosystem
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Switcher Header */}
        <div className="p-4 border-b border-zinc-800/80 shrink-0">
          <WorkspaceSwitcher currentOrg={currentOrg} availableOrgs={availableOrgs} />
        </div>

        {/* Workspace Domain Mode Selector (Business vs Personal vs Future) */}
        <div className="px-4 py-3 shrink-0">
          <div className="p-1 rounded-xl bg-zinc-900 border border-zinc-800/80 grid grid-cols-3 gap-1">
            <button
              onClick={() => {
                onWorkspaceModeChange("business");
                onSectionChange("overview");
              }}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                workspaceMode === "business"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Business</span>
            </button>

            <button
              onClick={() => {
                onWorkspaceModeChange("personal");
                onSectionChange("overview");
              }}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                workspaceMode === "personal"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Personal</span>
            </button>

            <button
              onClick={() => {
                onWorkspaceModeChange("future");
                onSectionChange("future-modules");
              }}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                workspaceMode === "future"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Future Modular Extension"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Module</span>
            </button>
          </div>
        </div>

        {/* Scrollable Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {workspaceMode === "business"
              ? "Commercial Finance"
              : workspaceMode === "personal"
              ? "Individual Ledger"
              : "Expandable Core"}
          </div>

          {workspaceMode === "business" &&
            businessNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-800 text-white font-semibold border-l-2 border-emerald-500"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-zinc-500"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

          {workspaceMode === "personal" &&
            personalNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-800 text-white font-semibold border-l-2 border-cyan-500"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-zinc-500"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

          {workspaceMode === "future" && (
            <button
              onClick={() => handleNavClick("future-modules")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-white border-l-2 border-purple-500"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Extensible Modules</span>
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold">
                SOON
              </span>
            </button>
          )}
        </nav>

        {/* Footer Tenant Scope Tag */}
        <div className="p-4 border-t border-zinc-800/80 shrink-0 text-center">
          <span className="text-[10px] text-zinc-500 font-mono block">
            {workspaceMode === "business"
              ? `Tenant: ${currentOrg.slug}`
              : "Personal User Scope"}
          </span>
        </div>
      </aside>
    </>
  );
}
