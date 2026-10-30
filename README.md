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

## 📁 Project Structure

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
│   ├── gst.test.ts             # Indian GST calculation & format tests
│   └── tenancy.test.ts         # Multi-tenant isolation & RBAC authorization tests
├── public/                     # Static assets
└── src/
    ├── app/                    # Next.js App Router (pages, layouts, routes)
    │   ├── layout.tsx          # Root layout
    │   ├── page.tsx            # Initial landing view
    │   └── globals.css         # Global styles & Tailwind directives
    ├── components/             # Reusable UI & domain components
    │   ├── ui/                 # Atomic UI primitives
    │   └── shared/             # Shared layout and navigation components
    ├── lib/                    # Core Services & Business Logic
    │   ├── audit.ts            # Append-only audit logging service
    │   ├── gst.ts              # Indian GST engine with Decimal precision
    │   ├── prisma.ts           # Prisma client with immutable audit extension
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
