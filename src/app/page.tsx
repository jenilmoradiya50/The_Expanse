export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 p-6 font-sans">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-sm sm:p-12">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              The Expanse
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Modular Business & Personal Financial Management Platform
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            Phase 0 Ready
          </span>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Environment & Stack
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                <span className="text-zinc-500 text-xs block">Framework</span>
                <span className="font-medium text-zinc-200">Next.js (App Router)</span>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                <span className="text-zinc-500 text-xs block">Language</span>
                <span className="font-medium text-zinc-200">TypeScript</span>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                <span className="text-zinc-500 text-xs block">Styling</span>
                <span className="font-medium text-zinc-200">Tailwind CSS v4</span>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                <span className="text-zinc-500 text-xs block">Database (Target)</span>
                <span className="font-medium text-zinc-200">Neon PostgreSQL</span>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                <span className="text-zinc-500 text-xs block">ORM (Target)</span>
                <span className="font-medium text-zinc-200">Prisma</span>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                <span className="text-zinc-500 text-xs block">Deployment</span>
                <span className="font-medium text-zinc-200">Vercel</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/30 p-4">
            <h3 className="text-sm font-medium text-zinc-300">Phase 0 Status</h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Base development environment initialized. Clean architecture, configuration, and build verification completed. Awaiting authorization to proceed to Phase 1 (Database & Multi-Tenant Core Architecture).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
