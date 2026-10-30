"use client";

import { Menu, ShieldCheck, FileCheck } from "lucide-react";
import { UserProfileMenu } from "./UserProfileMenu";
import type { AuthenticatedUser } from "@/lib/session";
import type { WorkspaceMode } from "./Sidebar";
import type { RoleType } from "@/types";

interface TopbarProps {
  user: AuthenticatedUser;
  currentOrg: {
    id: string;
    name: string;
    slug: string;
    role: RoleType;
    gstin?: string | null;
  };
  workspaceMode: WorkspaceMode;
  onOpenMobileMenu: () => void;
  securityNotice?: string;
}

export function Topbar({
  user,
  currentOrg,
  workspaceMode,
  onOpenMobileMenu,
  securityNotice,
}: TopbarProps) {
  return (
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Menu Toggle & Workspace Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-zinc-300 capitalize hidden sm:inline">
            {workspaceMode === "business"
              ? "Business Operations"
              : workspaceMode === "personal"
              ? "Personal Finance"
              : "Expandable Core"}
          </span>
          <span className="text-zinc-600 hidden sm:inline">/</span>
          <span className="text-zinc-100 font-medium truncate max-w-[160px] sm:max-w-none">
            {workspaceMode === "business" ? currentOrg.name : user.name}
          </span>
        </div>
      </div>

      {/* Right: GST Badge, Security Tag, and Profile Menu */}
      <div className="flex items-center gap-3">
        {/* Security Warning Pill if active */}
        {securityNotice && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <span className="font-medium text-[11px]">{securityNotice}</span>
          </div>
        )}

        {/* GSTIN Badge if in Business Workspace */}
        {workspaceMode === "business" && currentOrg.gstin && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-zinc-500 font-medium">GSTIN:</span>
            <span className="font-mono text-[11px] text-zinc-200">{currentOrg.gstin}</span>
          </div>
        )}

        {/* Development Badge */}
        <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400">
          <ShieldCheck className="w-3 h-3" />
          Multi-Tenant Verified
        </div>

        {/* Profile Dropdown */}
        <UserProfileMenu user={user} />
      </div>
    </header>
  );
}
