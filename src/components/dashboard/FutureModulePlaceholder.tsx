"use client";

import { Sparkles, Layers, Box, Cpu } from "lucide-react";

export function FutureModulePlaceholder() {
  return (
    <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto shadow-inner">
        <Sparkles className="w-8 h-8" />
      </div>

      <div className="max-w-md mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-300">
          <Layers className="w-3.5 h-3.5" />
          Future Expandable Module • Coming Soon
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Modular Extensibility Ecosystem
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The Expanse architecture is engineered with pluggable personal modules. This area is reserved for custom financial extensions, specialized asset tracking, and automated workflows. Features will be activated in later roadmap stages.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto pt-4 text-left">
        <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 text-xs space-y-1">
          <Box className="w-4 h-4 text-purple-400" />
          <p className="font-medium text-zinc-200">Asset Tracking</p>
          <p className="text-[11px] text-zinc-500">Planned integration</p>
        </div>
        <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 text-xs space-y-1">
          <Cpu className="w-4 h-4 text-purple-400" />
          <p className="font-medium text-zinc-200">AI Financial Insights</p>
          <p className="text-[11px] text-zinc-500">Roadmap Phase 5</p>
        </div>
        <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 text-xs space-y-1">
          <Layers className="w-4 h-4 text-purple-400" />
          <p className="font-medium text-zinc-200">Custom Workflows</p>
          <p className="text-[11px] text-zinc-500">Pluggable API</p>
        </div>
      </div>
    </div>
  );
}
