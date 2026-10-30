# The Expanse

> **A scalable, modular Business & Personal Financial Management System.**

"The Expanse" represents an expanding financial ecosystem designed for modern businesses and individuals. Rather than a simple expense tracker, it provides a unified, multi-tenant platform featuring organization-level data isolation, Indian GST compliance, full financial audit logs, and extensible personal and commercial finance workflows.

---

## 🏛️ Agreed Technology Stack

| Layer | Technology | Status |
| :--- | :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) (App Router, React 19) | Initialized |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | Initialized |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Initialized |
| **Local Database** | [SQLite](https://www.sqlite.org/) via Prisma | Active (Local Development) |
| **Production Database** | [Neon PostgreSQL](https://neon.tech/) | Migration ready prior to production |
| **ORM** | [Prisma](https://www.prisma.io/) | Initializing |
| **Production Deployment** | [Vercel](https://vercel.com/) | Gated (Planned at 70–80% feature milestone upon owner approval) |
| **Version Control** | GitHub (`jenilmoradiya50/The_Expanse`) | Main branch active |

---

## 📐 Core Architecture & Requirements

* **Multi-Tenancy:** Multi-organization support with strict tenant-level isolation on all queries and mutations.
* **Role-Based Access Control (RBAC):** Organization membership with granular roles (e.g., Owner, Admin, Accountant, Viewer).
* **Indian GST Support:** CGST, SGST, IGST calculations, HSN/SAC code tracking, GSTIN validation, and compliant tax invoice generation.
* **Audit History:** Immutable audit trails capturing user actions, financial record changes, before/after states, and timestamps.
* **Document Attachments:** Secure receipt, invoice, and bill attachment capabilities.
* **Dual Domain Modules:**
  * **Business Finance:** Invoicing, GST ledger, accounts payable/receivable, customer/vendor management.
  * **Personal Finance:** Net worth, personal budgeting, expense categorisation, cash flow tracking.
  * **Extensibility:** Pluggable personal-use and commercial extension modules.

---

## 💼 Core Business Modules (Phase 4, 4.1 & 4.2 Verification)

* **Strict Production Authentication Guard (Phase 4.2):** Development demo credentials are unconditionally impossible whenever `NODE_ENV === "production"`. Any environment-variable bypass (`ALLOW_DEV_DEMO_AUTH`) has been completely eliminated. Real production deployments strictly mandate official authentication provider integration (e.g. NextAuth/OIDC).
* **Ledger Balance Reconciliation (Phase 4.2):** Robust reconciliation services (`reconcileCustomerBalance`, `reconcileVendorBalance`) compare cached balances against active invoices, partial payments, unallocated advances, and cancelled/archived records. Payments are strictly prevented from double deduction. When `autoFix` is enabled, balance corrections execute inside a database transaction and generate an immutable `AuditLog` entry.
* **Statutory GST Accounting & Disclaimers (Phase 4.2):** Explicitly distinguishes Output GST liability (sales), Estimated Input Tax Credit (purchases), and Estimated Net GST Payable. Clearly notes that purchase GST is not automatically eligible for ITC without statutory GSTR-2B reconciliation and Section 17(5) blocked credit review.
* **Financial Integrity & Atomicity:** All payment recordings (`recordPayment`), invoice creations (`createInvoice`), balance updates, and audit records execute within atomic interactive database transactions (`prisma.$transaction`). Concurrent race conditions and lost updates are prevented via optimistic conditional matching on invoice balances. Overpayments are strictly rejected.
* **Document Sequence Engine:** Atomic, collision-free numbering via a dedicated `DocumentSequence` model scoped by `[organizationId, type, year]` (`INV-YYYY-XXXX`, `BILL-YYYY-XXXX`, `SO-YYYY-XXXX`, `PO-YYYY-XXXX`), eliminating race condition collisions of naive `count() + 1` patterns.
* **Decoupled Order Lifecycle & Invoicing:** Line-item level tracking of `invoicedQuantity` and `fulfilledQuantity`. Invoicing does not prematurely complete orders (`invoicingStatus` transitions from `UNINVOICED` -> `PARTIALLY_INVOICED` -> `FULLY_INVOICED`), preserving fulfillment state. Over-invoicing is prevented at the item level.
* **Master Data Uniqueness:** Enforced database-level uniqueness for `[organizationId, gstin]` on both `Customer` and `Vendor`, with proper normalization of empty strings to `null`.
* **Payment Idempotency:** Enforced database-level uniqueness for `[organizationId, referenceNumber]` on `Payment` to prevent duplicate transaction entries.
* **Customers & Suppliers (Vendors):** Contact profiles, GSTIN validation, state codes, payment terms, soft-archival (`isArchived`).
* **Products & Services Catalog:** SKU uniqueness validation, HSN/SAC code tracking, physical units vs services, pricing, and applicable GST rate mapping.
* **Sales & Purchase Orders:** Multi-line order authoring with real-time Decimal tax calculations (CGST/SGST for intra-state, IGST for inter-state), and discount calculations.
* **Invoices & Bills:** Sales invoices and supplier purchase bills with payment terms, due dates, balance tracking, and 1-click Order-to-Invoice conversion.

---

```
The_Expanse/
├── .env.example                # Template for environment variables (placeholders only)
├── .gitignore                  # Git ignore rules
├── eslint.config.mjs           # ESLint configuration
├── next.config.ts              # Next.js configuration
├── package.json                # Project dependencies and scripts
├── tsconfig.json               # TypeScript configuration with @/* path alias
├── prisma/
│   ├── schema.prisma           # Multi-tenant data models (SQLite dev / Neon prod)
│   └── seed.ts                 # Demo & synthetic development seeder
├── tests/                      # Automated test suite (tsx + node:test)
│   ├── audit.test.ts           # Append-only immutability tests
│   ├── business.test.ts        # Phase 4 Core Business Management tests
│   ├── gst.test.ts             # Indian GST calculation & format tests
│   ├── integrity.test.ts       # Phase 4.1 & 4.2 Financial Integrity & Concurrency tests (11 tests)
│   ├── shell.test.ts           # Tenant context & workspace switching tests
│   └── tenancy.test.ts         # Multi-tenant isolation & RBAC authorization tests
├── public/                     # Static assets
└── src/
    ├── app/                    # Next.js App Router (pages, layouts, routes)
    │   ├── layout.tsx          # Root layout
    │   ├── page.tsx            # Multi-tenant dashboard shell (Suspense + streaming)
    │   └── globals.css         # Global styles & Tailwind directives
    ├── components/             # Reusable UI & domain components
    │   ├── dashboard/          # Domain-specific dashboard views
    │   │   ├── BusinessDashboard.tsx      # Commercial master records, orders, invoices, payments, metrics
    │   │   ├── PersonalDashboard.tsx      # Isolated user net worth, accounts & cash flow
    │   │   └── FutureModulePlaceholder.tsx# Pluggable modular ecosystem preview
    │   └── layout/             # Shell layout primitives
    │       ├── Shell.tsx                  # App layout orchestrator & drawer state
    │       ├── Sidebar.tsx                # Left navigation with domain mode switcher
    │       ├── Topbar.tsx                 # Top navigation with GST & security indicators
    │       ├── UserProfileMenu.tsx        # Server-verified user identity dropdown
    │       └── WorkspaceSwitcher.tsx      # Multi-org switcher with server-side validation
    ├── lib/                    # Core Services & Business Logic
    │   ├── actions.ts          # Server actions (switchOrg, metrics loaders, business entity mutations)
    │   ├── audit.ts            # Append-only audit logging service
    │   ├── business.ts         # Phase 4 Core Business domain service & ledger reconciliation
    │   ├── gst.ts              # Indian GST engine with Decimal precision
    │   ├── prisma.ts           # Prisma client with immutable audit extension
    │   ├── session.ts          # Server-side user identity & active tenant resolver
    │   ├── tenancy.ts          # Server-side tenant authorization & RBAC
    │   └── utils.ts            # Common helpers
    └── types/                  # Shared TypeScript type definitions
        ├── database.ts         # Enums, roles, and GST state codes
        └── index.ts            # Base application types
```

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: v20+ LTS (Tested on v26)
* **npm**: v11+ (Use `npm.cmd` on Windows PowerShell environments)
* **Git**: v2.40+

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jenilmoradiya50/The_Expanse.git
   cd The_Expanse
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env.local
   ```

3. **Install Dependencies:**
   ```bash
   npm.cmd install
   ```

4. **Initialize & Seed Local Database:**
   ```bash
   npx.cmd prisma db push
   npx.cmd prisma db seed
   ```

5. **Run Automated Tests:**
   ```bash
   npm.cmd run test
   ```

6. **Run Development Server:**
   ```bash
   npm.cmd run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

7. **Build for Production:**
   ```bash
   npm.cmd run build
   ```

---

## 🔒 Security & Code Quality

* Never commit `.env` or files containing production credentials.
* All data mutations must enforce organization boundary checks.
* Strictly follow Phase-based implementation gates.
