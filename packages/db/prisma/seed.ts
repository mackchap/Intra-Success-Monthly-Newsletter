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
            { name: "Won", order: 4, probability: 100 },
            { name: "Lost", order: 5, probability: 0 },
          ],
        },
      },
    }));

  console.log(`Pipeline ready: ${pipeline.name} (${pipeline.id})`);

  // Seed a single admin user for local dev login. Change the password
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
