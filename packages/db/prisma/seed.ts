import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Default sales pipeline with a standard stage progression.
  const existingPipeline = await prisma.pipeline.findFirst({ where: { isDefault: true } });
  const pipeline =
    existingPipeline ??
    (await prisma.pipeline.create({
      data: {
        name: "Default Pipeline",
        isDefault: true,
        stages: {
          create: [
            { name: "Lead", order: 0, probability: 10 },
            { name: "Qualified", order: 1, probability: 30 },
            { name: "Proposal", order: 2, probability: 60 },
            { name: "Negotiation", order: 3, probability: 80 },
            { name: "Won", order: 4, probability: 100, isWon: true },
            { name: "Lost", order: 5, probability: 0, isLost: true },
          ],
        },
      },
    }));

  // Reconcile isWon/isLost even when the pipeline already existed from an
  // earlier seed run — new stage flags added to the seed definition should
  // still land on a pipeline created before they existed.
  await prisma.pipelineStage.updateMany({
    where: { pipelineId: pipeline.id, name: "Won" },
    data: { isWon: true, isLost: false },
  });
  await prisma.pipelineStage.updateMany({
    where: { pipelineId: pipeline.id, name: "Lost" },
    data: { isWon: false, isLost: true },
  });

  console.log(`Pipeline ready: ${pipeline.name} (${pipeline.id})`);

  // Seed an admin and a staff user for local dev login. Change passwords
  // immediately in any shared environment.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      role: Role.ADMIN,
      password: await hash(adminPassword, 10),
    },
  });

  console.log(`Admin user ready: ${admin.email} (password: ${adminPassword})`);

  const staff = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      email: "staff@example.com",
      name: "Sam Staff",
      role: Role.STAFF,
      password: await hash("changeme123", 10),
    },
  });

  console.log(`Staff user ready: ${staff.email} (password: changeme123)`);

  // A handful of sample CRM records so Phase 2 has something to look at.
  const acme = await prisma.company.upsert({
    where: { id: "seed-company-acme" },
    update: {},
    create: {
      id: "seed-company-acme",
      name: "Acme Corp",
      domain: "acme.example",
      industry: "Manufacturing",
    },
  });

  const globex = await prisma.company.upsert({
    where: { id: "seed-company-globex" },
    update: {},
    create: {
      id: "seed-company-globex",
      name: "Globex Inc",
      domain: "globex.example",
      industry: "Retail",
    },
  });

  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { order: "asc" },
  });
  const stageByName = Object.fromEntries(stages.map((s) => [s.name, s]));

  const contactsData = [
    {
      id: "seed-contact-jane",
      email: "jane.doe@acme.example",
      firstName: "Jane",
      lastName: "Doe",
      companyId: acme.id,
      ownerId: staff.id,
      dealTitle: "Acme — annual contract",
      dealStage: stageByName["Qualified"],
      dealValueCents: 1_200_000,
    },
    {
      id: "seed-contact-bob",
      email: "bob.smith@globex.example",
      firstName: "Bob",
      lastName: "Smith",
      companyId: globex.id,
      ownerId: staff.id,
      dealTitle: "Globex — pilot program",
      dealStage: stageByName["Lead"],
      dealValueCents: 350_000,
    },
    {
      id: "seed-contact-mia",
      email: "mia.chen@acme.example",
      firstName: "Mia",
      lastName: "Chen",
      companyId: acme.id,
      ownerId: admin.id,
      dealTitle: "Acme — expansion package",
      dealStage: stageByName["Negotiation"],
      dealValueCents: 2_500_000,
    },
  ];

  for (const c of contactsData) {
    const contact = await prisma.contact.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        companyId: c.companyId,
        ownerId: c.ownerId,
        source: "manual",
      },
    });

    await prisma.deal.upsert({
      where: { id: `${c.id}-deal` },
      update: {},
      create: {
        id: `${c.id}-deal`,
        title: c.dealTitle,
        contactId: contact.id,
        companyId: c.companyId,
        ownerId: c.ownerId,
        pipelineId: pipeline.id,
        stageId: c.dealStage.id,
        valueCents: c.dealValueCents,
      },
    });
  }

  console.log(`Seeded ${contactsData.length} sample contacts + deals across ${acme.name} and ${globex.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
