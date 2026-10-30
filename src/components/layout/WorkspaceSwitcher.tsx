"use client";

import { useState, useTransition } from "react";
import { Building2, ChevronDown, Check, Shield } from "lucide-react";
import { switchOrganizationAction } from "@/lib/actions";
import type { RoleType } from "@/types";

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  role: RoleType;
  isDefault: boolean;
  gstin: string | null;
}

interface WorkspaceSwitcherProps {
  currentOrg: {
    id: string;
    name: string;
    slug: string;
    role: RoleType;
    gstin?: string | null;
  };
  availableOrgs: OrgItem[];
}

export function WorkspaceSwitcher({ currentOrg, availableOrgs }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSelect = (orgId: string) => {
    if (orgId === currentOrg.id) {
      setIsOpen(false);
      return;
    }

    startTransition(async () => {
      try {
        await switchOrganizationAction(orgId);
        setIsOpen(false);
      } catch (err) {
        console.error("Failed to switch organization:", err);
      }
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800/80 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-100 truncate block">
                {currentOrg.name}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-emerald-400" />
                {currentOrg.role}
              </span>
              <span className="text-xs text-zinc-500 truncate">
                {currentOrg.slug}
              </span>
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl p-2 space-y-1">
            <div className="px-2 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Authorized Workspaces ({availableOrgs.length})
            </div>
            {availableOrgs.map((org) => {
              const isSelected = org.id === currentOrg.id;
              return (
                <button
                  key={org.id}
                  onClick={() => handleSelect(org.id)}
                  disabled={isPending}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors ${
                    isSelected
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-white"
                      : "hover:bg-zinc-800/70 text-zinc-300"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium truncate">{org.name}</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                      <span className="text-[10px] uppercase font-semibold text-zinc-400">
                        {org.role}
                      </span>
                      {org.gstin && (
                        <span className="text-[10px] text-zinc-500 font-mono truncate">
                          {org.gstin}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
