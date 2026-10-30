import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database for The Expanse...");

  // 1. Create Default Owner User
  const owner = await prisma.user.upsert({
    where: { email: "jenil@theexpanse.local" },
    update: {},
    create: {
      email: "jenil@theexpanse.local",
      name: "Jenil Moradiya",
    },
  });
  console.log(`👤 User created/verified: ${owner.name} (${owner.email})`);

  // 2. Create Primary Business Organization
  const org = await prisma.organization.upsert({
    where: { slug: "expanse-tech" },
    update: {},
    create: {
      name: "Expanse Tech Ventures",
      slug: "expanse-tech",
      currency: "INR",
      timezone: "Asia/Kolkata",
      fiscalYearStart: 4, // April
    },
  });
  console.log(`🏢 Organization created/verified: ${org.name} (${org.slug})`);

  // 3. Create Owner Membership
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
  console.log(`🔑 Membership assigned: OWNER for ${owner.name} in ${org.name}`);

  // 4. Create Indian GST Profile for Organization
  await prisma.gstProfile.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      gstin: "24AAAAA0000A1Z5",
      legalName: "Expanse Tech Ventures Private Limited",
      tradeName: "Expanse Tech",
      pan: "AAAAA0000A",
      stateCode: "24",
      stateName: "Gujarat",
      isComposition: false,
      registeredAddress: "101, Titanium Financial City, SG Highway, Ahmedabad, Gujarat - 380054",
    },
  });
  console.log(`📑 GST Profile initialized: 24AAAAA0000A1Z5 (Gujarat)`);

  // 5. Create Sample Customer & Vendor
  const customer = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: "Apex Logistics India Pvt Ltd",
      email: "billing@apexlogistics.in",
      phone: "+91 98765 43210",
      gstin: "27AABCA1234F1Z8",
      pan: "AABCA1234F",
      stateCode: "27", // Maharashtra (Inter-state supply => IGST)
      billingAddress: "402, Trade Tower, Bandra Kurla Complex, Mumbai, Maharashtra - 400051",
      balance: 0,
    },
  });

  const vendor = await prisma.vendor.create({
    data: {
      organizationId: org.id,
      name: "CloudScale Infra Solutions",
      email: "accounts@cloudscale.in",
      phone: "+91 91234 56789",
      gstin: "24BBBBB1111B1Z2",
      pan: "BBBBB1111B",
      address: "GF-12, Infocity Tower, Gandhinagar, Gujarat - 382007",
      bankName: "HDFC Bank",
      bankAccountNumber: "50200012345678",
      bankIfsc: "HDFC0000123",
      balance: 0,
    },
  });
  console.log(`🤝 Sample Customer (${customer.name}) and Vendor (${vendor.name}) created.`);

  // 6. Create Initial Personal Accounts
  const personalAccounts = [
    { name: "HDFC Bank (Salary)", type: "SAVINGS", initialBalance: 250000, currentBalance: 250000, accountNumberLast4: "4321" },
    { name: "ICICI Sapphiro Credit Card", type: "CREDIT_CARD", initialBalance: 0, currentBalance: 0, accountNumberLast4: "9876" },
    { name: "Cash Wallet", type: "CASH", initialBalance: 12000, currentBalance: 12000 },
  ];

  for (const acc of personalAccounts) {
    await prisma.personalAccount.create({
      data: {
        userId: owner.id,
        ...acc,
      },
    });
  }
  console.log(`💳 Created ${personalAccounts.length} Personal Accounts.`);

  // 7. Create Initial Personal Categories
  const categories = [
    { name: "Monthly Salary", type: "INCOME", color: "#10B981" },
    { name: "Dividends & Returns", type: "INCOME", color: "#06B6D4" },
    { name: "Groceries & Supermarket", type: "EXPENSE", color: "#F59E0B" },
    { name: "Dining & Social", type: "EXPENSE", color: "#EF4444" },
    { name: "Utilities & Subscriptions", type: "EXPENSE", color: "#8B5CF6" },
    { name: "Fuel & Transportation", type: "EXPENSE", color: "#6366F1" },
  ];

  for (const cat of categories) {
    await prisma.personalCategory.create({
      data: {
        userId: owner.id,
        ...cat,
      },
    });
  }
  console.log(`🏷️ Created ${categories.length} Personal Categories.`);

  // 8. Record Immutable Audit Log
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: owner.id,
      action: "CREATE",
      entity: "ORGANIZATION",
      entityId: org.id,
      newValues: JSON.stringify({ name: org.name, slug: org.slug, seeded: true }),
      ipAddress: "127.0.0.1",
      userAgent: "The Expanse CLI Seeder v1.0",
    },
  });
  console.log(`🔒 Audit log record registered.`);

  console.log("✅ Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
