import { PrismaClient } from "@prisma/client";

/**
 * =============================================================================
 * THE EXPANSE - DATABASE SEED SCRIPT (DEVELOPMENT / TEST ENVIRONMENT ONLY)
 *
 * NOTICE & DISCLAIMER:
 * All organizations, businesses, GSTINs, PANs, client names, vendor names,
 * and addresses contained in this seed script are strictly FICTITIOUS AND
 * SYNTHETIC SAMPLE DATA generated for local development and testing purposes.
 * None of the entities listed represent an actual registered business or
 * taxpayer on the GSTN portal.
 * =============================================================================
 */

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database with labeled development/demo data...");

  // 1. Create Default Owner User
  const owner = await prisma.user.upsert({
    where: { email: "jenil@theexpanse.local" },
    update: {},
    create: {
      email: "jenil@theexpanse.local",
      name: "Jenil Moradiya (Dev Owner)",
    },
  });
  console.log(`👤 User created/verified: ${owner.name} (${owner.email})`);

  // 2. Create Primary Business Organization (Clearly Labeled as Demo)
  const org = await prisma.organization.upsert({
    where: { slug: "expanse-tech" },
    update: {
      name: "Expanse Tech Ventures [DEMO / DEV ONLY]",
    },
    create: {
      name: "Expanse Tech Ventures [DEMO / DEV ONLY]",
      slug: "expanse-tech",
      currency: "INR",
      timezone: "Asia/Kolkata",
      fiscalYearStart: 4, // April
    },
  });
  console.log(`🏢 Primary Org: ${org.name} (${org.slug})`);

  // 2b. Create Secondary Business Organization (To verify multi-org switching)
  const org2 = await prisma.organization.upsert({
    where: { slug: "expanse-logistics" },
    update: {
      name: "Expanse Global Logistics [DEMO / DEV ONLY]",
    },
    create: {
      name: "Expanse Global Logistics [DEMO / DEV ONLY]",
      slug: "expanse-logistics",
      currency: "INR",
      timezone: "Asia/Kolkata",
      fiscalYearStart: 4,
    },
  });
  console.log(`🏢 Secondary Org: ${org2.name} (${org2.slug})`);

  // 2c. Create Restricted Third-Party Organization (User is NOT a member - for security tests)
  const restrictedOrg = await prisma.organization.upsert({
    where: { slug: "restricted-corp" },
    update: {
      name: "Restricted Enterprise Corp [DEMO / UNRELATED ORG]",
    },
    create: {
      name: "Restricted Enterprise Corp [DEMO / UNRELATED ORG]",
      slug: "restricted-corp",
      currency: "INR",
      timezone: "Asia/Kolkata",
      fiscalYearStart: 4,
    },
  });
  console.log(`🏢 Restricted Org: ${restrictedOrg.name} (${restrictedOrg.slug})`);

  // 3. Create Memberships
  // Org 1: OWNER
  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: owner.id,
      },
    },
    update: {
      role: "OWNER",
      isDefault: true,
    },
    create: {
      organizationId: org.id,
      userId: owner.id,
      role: "OWNER",
      isDefault: true,
    },
  });

  // Org 2: ADMIN
  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org2.id,
        userId: owner.id,
      },
    },
    update: {
      role: "ADMIN",
      isDefault: false,
    },
    create: {
      organizationId: org2.id,
      userId: owner.id,
      role: "ADMIN",
      isDefault: false,
    },
  });
  console.log(`🔑 Memberships assigned: OWNER in ${org.name}, ADMIN in ${org2.name}`);

  // 4. Create Indian GST Profile for Organization (Clearly Marked Fictitious)
  await prisma.gstProfile.upsert({
    where: { organizationId: org.id },
    update: {
      legalName: "Expanse Tech Ventures Pvt Ltd [DEMO DATA - NOT A REGISTERED BUSINESS]",
      tradeName: "Expanse Tech (Demo)",
      registeredAddress: "Suite 101, Test Development Complex, Sandbox City, Gujarat - 380001 [FICTITIOUS SAMPLE ADDRESS]",
    },
    create: {
      organizationId: org.id,
      gstin: "24AAAAA0000A1Z5", // Mock sandbox test pattern
      legalName: "Expanse Tech Ventures Pvt Ltd [DEMO DATA - NOT A REGISTERED BUSINESS]",
      tradeName: "Expanse Tech (Demo)",
      pan: "AAAAA0000A",
      stateCode: "24",
      stateName: "Gujarat",
      isComposition: false,
      registeredAddress: "Suite 101, Test Development Complex, Sandbox City, Gujarat - 380001 [FICTITIOUS SAMPLE ADDRESS]",
    },
  });
  console.log(`📑 GST Profile initialized: 24AAAAA0000A1Z5 (Gujarat Mock Sandbox)`);

  // 5. Create Sample Customer & Vendor (Clearly Labeled)
  const customer = await prisma.customer.upsert({
    where: { id: "demo-customer-apex" },
    update: {
      name: "Apex Logistics India Pvt Ltd [SAMPLE DEMO CLIENT]",
      billingAddress: "402, Mock Trade Tower, Bandra Kurla Complex, Mumbai, Maharashtra - 400051 [FICTITIOUS ADDRESS]",
    },
    create: {
      id: "demo-customer-apex",
      organizationId: org.id,
      name: "Apex Logistics India Pvt Ltd [SAMPLE DEMO CLIENT]",
      email: "demo-billing@apexlogistics-sample.in",
      phone: "+91 98765 00000",
      gstin: "27AABCA1234F1Z8", // Mock GSTIN
      pan: "AABCA1234F",
      stateCode: "27", // Maharashtra (Inter-state relative to Gujarat => IGST)
      billingAddress: "402, Mock Trade Tower, Bandra Kurla Complex, Mumbai, Maharashtra - 400051 [FICTITIOUS ADDRESS]",
      balance: 0,
    },
  });

  const vendor = await prisma.vendor.upsert({
    where: { id: "demo-vendor-cloudscale" },
    update: {
      name: "CloudScale Infra Solutions [SAMPLE DEMO VENDOR]",
      address: "GF-12, Sandbox Tech Park, Gandhinagar, Gujarat - 382007 [FICTITIOUS ADDRESS]",
    },
    create: {
      id: "demo-vendor-cloudscale",
      organizationId: org.id,
      name: "CloudScale Infra Solutions [SAMPLE DEMO VENDOR]",
      email: "demo-accounts@cloudscale-sample.in",
      phone: "+91 91234 00000",
      gstin: "24BBBBB1111B1Z2", // Mock GSTIN
      pan: "BBBBB1111B",
      address: "GF-12, Sandbox Tech Park, Gandhinagar, Gujarat - 382007 [FICTITIOUS ADDRESS]",
      bankName: "HDFC Bank (Demo Branch)",
      bankAccountNumber: "50200000000000",
      bankIfsc: "HDFC0000000",
      balance: 0,
    },
  });
  console.log(`🤝 Sample Customer (${customer.name}) and Vendor (${vendor.name}) updated with demo labels.`);

  // 6. Create Initial Personal Accounts
  const personalAccounts = [
    { name: "HDFC Bank (Salary - Demo)", type: "SAVINGS", initialBalance: 250000, currentBalance: 250000, accountNumberLast4: "4321" },
    { name: "ICICI Sapphiro Credit Card (Demo)", type: "CREDIT_CARD", initialBalance: 0, currentBalance: 0, accountNumberLast4: "9876" },
    { name: "Cash Wallet (Demo)", type: "CASH", initialBalance: 12000, currentBalance: 12000 },
  ];

  for (const acc of personalAccounts) {
    const existing = await prisma.personalAccount.findFirst({
      where: { userId: owner.id, name: acc.name },
    });
    if (!existing) {
      await prisma.personalAccount.create({
        data: {
          userId: owner.id,
          ...acc,
        },
      });
    }
  }
  console.log(`💳 Personal Accounts verified.`);

  // 7. Create Initial Personal Categories
  const categories = [
    { name: "Monthly Salary (Demo)", type: "INCOME", color: "#10B981" },
    { name: "Dividends & Returns (Demo)", type: "INCOME", color: "#06B6D4" },
    { name: "Groceries & Supermarket", type: "EXPENSE", color: "#F59E0B" },
    { name: "Dining & Social", type: "EXPENSE", color: "#EF4444" },
    { name: "Utilities & Subscriptions", type: "EXPENSE", color: "#8B5CF6" },
    { name: "Fuel & Transportation", type: "EXPENSE", color: "#6366F1" },
  ];

  for (const cat of categories) {
    const existing = await prisma.personalCategory.findFirst({
      where: { userId: owner.id, name: cat.name },
    });
    if (!existing) {
      await prisma.personalCategory.create({
        data: {
          userId: owner.id,
          ...cat,
        },
      });
    }
  }
  console.log(`🏷️ Personal Categories verified.`);

  // 8. Record Immutable Audit Log
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: owner.id,
      action: "UPDATE",
      entity: "ORGANIZATION",
      entityId: org.id,
      newValues: JSON.stringify({
        name: org.name,
        slug: org.slug,
        reseeded: true,
        disclaimer: "Development and testing sample data only",
      }),
      ipAddress: "127.0.0.1",
      userAgent: "The Expanse Phase 2 Seeder",
    },
  });
  console.log(`🔒 Audit log record registered.`);

  console.log("✅ Seed completed with clear development-only labels!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
