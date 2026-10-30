import { Suspense } from "react";
import { cookies } from "next/headers";
import { getActiveTenantContext } from "@/lib/session";
import { getBusinessMetrics, getPersonalMetrics } from "@/lib/actions";
import { Shell } from "@/components/layout/Shell";

async function DashboardLoader() {
  // Access dynamic request cookies to trigger Next.js PPR dynamic streaming boundary
  await cookies();

  // 1. Resolve server-side tenant and user identity
  const tenantContext = await getActiveTenantContext();

  // 2. Load verified tenant-isolated business metrics
  const businessData = await getBusinessMetrics(tenantContext.activeOrg.id);

  // 3. Load verified user-scoped personal metrics
  const personalData = await getPersonalMetrics();

  return (
    <Shell
      user={tenantContext.user}
      currentOrg={tenantContext.activeOrg}
      availableOrgs={tenantContext.availableOrgs}
      securityNotice={tenantContext.securityNotice}
      businessData={businessData}
      personalData={personalData}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar Skeleton */}
      <div className="hidden lg:flex w-72 bg-zinc-950 border-r border-zinc-800/80 flex-col p-4 space-y-4">
        <div className="h-10 bg-zinc-900 rounded-xl animate-pulse" />
        <div className="h-12 bg-zinc-900 rounded-xl animate-pulse" />
        <div className="h-8 bg-zinc-900 rounded-lg animate-pulse" />
        <div className="space-y-2 pt-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 bg-zinc-900/60 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>

      {/* Main Viewport Skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b border-zinc-800/80 bg-zinc-950 px-6 flex items-center justify-between">
          <div className="w-48 h-5 bg-zinc-900 rounded animate-pulse" />
          <div className="w-24 h-8 bg-zinc-900 rounded-full animate-pulse" />
        </div>

        <div className="p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          <div className="h-12 bg-zinc-900/40 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-zinc-900/60 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-80 bg-zinc-900/40 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardLoader />
    </Suspense>
  );
}
