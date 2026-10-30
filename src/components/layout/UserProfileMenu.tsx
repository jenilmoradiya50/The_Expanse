"use client";

import { useState } from "react";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import type { AuthenticatedUser } from "@/lib/session";

interface UserProfileMenuProps {
  user: AuthenticatedUser;
}

export function UserProfileMenu({ user }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 rounded-full hover:bg-zinc-800/80 transition-colors border border-transparent hover:border-zinc-700/60"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-semibold text-xs shadow">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="hidden md:block text-left text-xs pr-1">
          <span className="font-medium text-zinc-200 block leading-tight truncate max-w-[120px]">
            {user.name}
          </span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Verified
          </span>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 z-50 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl p-3">
            <div className="pb-3 border-b border-zinc-800">
              <p className="font-semibold text-sm text-zinc-100">{user.name}</p>
              <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">{user.email}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[11px] font-medium text-amber-400">
                <ShieldCheck className="w-3 h-3" />
                Dev Preview Session
              </div>
            </div>

            <div className="pt-2 space-y-1 text-xs text-zinc-400">
              <div className="p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/80 text-[11px] leading-relaxed">
                <span className="font-semibold text-zinc-300 block mb-0.5">Development Environment</span>
                Authenticated via server-side session. Production login gating will activate in Phase 4.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
