import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Phase 8: every CRM row belongs to a Tenant. This is the one tenant a
  // fresh database starts with — the same slug the Phase 8 migration
  // backfilled all pre-existing (pre-Phase-8) data onto, and the one
  // lib/accounts/legacy-tenant.ts points not-yet-tenant-scoped modules
  // (Funnels, Academy, Marketing, Orders) at until Phase 9.
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "intra-success-academy" },
    update: {},
    create: {
      name: "Intra Success Academy",
      slug: "intra-success-academy",
      platformSubscription: { create: { plan: "TRIAL", status: "TRIALING", trialEndsAt } },
    },
  });

  console.log(`Tenant ready: ${tenant.name} (${tenant.id})`);

  // Default sales pipeline with a standard stage progression.
  const existingPipeline = await prisma.pipeline.findFirst({ where: { tenantId: tenant.id, isDefault: true } });
  const pipeline =
    existingPipeline ??
    (await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
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
      isPlatformAdmin: true,
      password: await hash(adminPassword, 10),
    },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: tenant.id } },
    update: {},
    create: { userId: admin.id, tenantId: tenant.id, role: "OWNER" },
  });

  console.log(`Admin user ready: ${admin.email} (password: ${adminPassword}) — platform admin + Owner of ${tenant.name}`);

  const staff = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      email: "staff@example.com",
      name: "Sam Staff",
      password: await hash("changeme123", 10),
    },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: staff.id, tenantId: tenant.id } },
    update: {},
    create: { userId: staff.id, tenantId: tenant.id, role: "STAFF" },
  });

  console.log(`Staff user ready: ${staff.email} (password: changeme123) — Staff on ${tenant.name}`);

  // A handful of sample CRM records so Phase 2 has something to look at.
  const acme = await prisma.company.upsert({
    where: { id: "seed-company-acme" },
    update: {},
    create: {
      id: "seed-company-acme",
      tenantId: tenant.id,
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
      tenantId: tenant.id,
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
        tenantId: tenant.id,
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
        tenantId: tenant.id,
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

  // A sample customer login for exercising checkout/portal locally.
  const customer = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      name: "Cam Customer",
      password: await hash("changeme123", 10),
    },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: customer.id, tenantId: tenant.id } },
    update: {},
    create: { userId: customer.id, tenantId: tenant.id, role: "CUSTOMER" },
  });
  console.log(`Customer user ready: ${customer.email} (password: changeme123)`);

  // A sample course + product so /products/[id] has something to show.
  // No stripePriceId here — that only ever gets set by the price.* webhook
  // syncing a real Stripe Price, which needs real Stripe API keys this seed
  // script doesn't have. Create the matching Product in the Stripe Dashboard
  // (test mode) with metadata `type=COURSE` and `courseId=seed-course-intra`
  // to make this purchasable locally.
  const course = await prisma.course.upsert({
    where: { id: "seed-course-intra" },
    update: {},
    create: {
      id: "seed-course-intra",
      tenantId: tenant.id,
      title: "Intrapreneurship Fundamentals",
      slug: "intrapreneurship-fundamentals",
      description: "A sample course seeded for local Stripe checkout testing.",
      priceType: "PAID",
      priceCents: 9900,
      published: true,
    },
  });

  await prisma.product.upsert({
    where: { id: "seed-product-intra-course" },
    update: {},
    create: {
      id: "seed-product-intra-course",
      tenantId: tenant.id,
      name: course.title,
      type: "COURSE",
      priceCents: course.priceCents,
      courseId: course.id,
    },
  });

  console.log(`Sample course + product ready: ${course.title} (/products/seed-product-intra-course)`);

  // Modules/lessons covering every Academy access rule: immediate access,
  // drip delay, a lesson-level prerequisite, video/text/quiz lesson types.
  const module1 = await prisma.module.upsert({
    where: { id: "seed-module-1" },
    update: {},
    create: { id: "seed-module-1", courseId: course.id, title: "Getting Started", order: 0 },
  });
  const module2 = await prisma.module.upsert({
    where: { id: "seed-module-2" },
    update: {},
    create: { id: "seed-module-2", courseId: course.id, title: "Advanced Topics", order: 1 },
  });

  await prisma.lesson.upsert({
    where: { id: "seed-lesson-welcome" },
    update: {},
    create: {
      id: "seed-lesson-welcome",
      moduleId: module1.id,
      title: "Welcome",
      order: 0,
      type: "TEXT",
      content: "Welcome to the course! This lesson is available immediately after enrolling.",
    },
  });
  await prisma.lesson.upsert({
    where: { id: "seed-lesson-intro-video" },
    update: {},
    create: {
      id: "seed-lesson-intro-video",
      moduleId: module1.id,
      title: "Introduction video",
      order: 1,
      type: "VIDEO",
      videoProvider: "VIMEO",
      videoId: "76979871", // Vimeo's public staff-pick demo video
    },
  });
  await prisma.lesson.upsert({
    where: { id: "seed-lesson-drip" },
    update: {},
    create: {
      id: "seed-lesson-drip",
      moduleId: module2.id,
      title: "Week 2: Deeper practice",
      order: 0,
      type: "TEXT",
      content: "This lesson unlocks a week after enrollment (drip scheduling).",
      dripDelayDays: 7,
    },
  });
  await prisma.lesson.upsert({
    where: { id: "seed-lesson-quiz" },
    update: {},
    create: {
      id: "seed-lesson-quiz",
      moduleId: module2.id,
      title: "Check your understanding",
      order: 1,
      type: "QUIZ",
      prerequisiteLessonId: "seed-lesson-drip",
    },
  });
  await prisma.quiz.upsert({
    where: { lessonId: "seed-lesson-quiz" },
    update: {},
    create: {
      lessonId: "seed-lesson-quiz",
      questions: [
        {
          question: "What is intrapreneurship?",
          options: ["Starting an outside business", "Acting entrepreneurially inside an org", "A finance term"],
          correctIndex: 1,
        },
      ],
    },
  });

  // A free course, to exercise the self-enroll (no payment) path.
  const freeCourse = await prisma.course.upsert({
    where: { id: "seed-course-free" },
    update: {},
    create: {
      id: "seed-course-free",
      tenantId: tenant.id,
      title: "Community Basics",
      slug: "community-basics",
      description: "A free sample course anyone can self-enroll in.",
      priceType: "FREE",
      priceCents: 0,
      published: true,
    },
  });
  const freeModule = await prisma.module.upsert({
    where: { id: "seed-module-free" },
    update: {},
    create: { id: "seed-module-free", courseId: freeCourse.id, title: "Basics", order: 0 },
  });
  await prisma.lesson.upsert({
    where: { id: "seed-lesson-free" },
    update: {},
    create: {
      id: "seed-lesson-free",
      moduleId: freeModule.id,
      title: "Getting started, for free",
      order: 0,
      type: "TEXT",
      content: "Anyone can enroll in this course at no cost.",
    },
  });

  // A membership-tier course + a matching MEMBERSHIP product, to exercise
  // the "subscribe to access" path. Like the paid course's product, this
  // needs a real Stripe Price synced via webhook before it's purchasable.
  const membershipCourse = await prisma.course.upsert({
    where: { id: "seed-course-membership" },
    update: {},
    create: {
      id: "seed-course-membership",
      tenantId: tenant.id,
      title: "Founding Member Vault",
      slug: "founding-member-vault",
      description: "Included with an active membership subscription.",
      priceType: "MEMBERSHIP",
      priceCents: 2900,
      published: true,
    },
  });
  const membershipModule = await prisma.module.upsert({
    where: { id: "seed-module-membership" },
    update: {},
    create: { id: "seed-module-membership", courseId: membershipCourse.id, title: "Member Exclusives", order: 0 },
  });
  await prisma.lesson.upsert({
    where: { id: "seed-lesson-membership" },
    update: {},
    create: {
      id: "seed-lesson-membership",
      moduleId: membershipModule.id,
      title: "Welcome, members",
      order: 0,
      type: "TEXT",
      content: "Available to anyone with an active membership subscription.",
    },
  });
  await prisma.product.upsert({
    where: { id: "seed-product-membership" },
    update: {},
    create: {
      id: "seed-product-membership",
      tenantId: tenant.id,
      name: "Founding Member",
      type: "MEMBERSHIP",
      priceCents: 2900,
    },
  });

  console.log(
    `Also seeded: ${freeCourse.title} (free) and ${membershipCourse.title} (membership) with sample lessons.`,
  );

  // A sample 4-step funnel: landing -> opt-in (creates a Contact+Deal) ->
  // offer/checkout (sells the seeded paid course) -> thank-you.
  const funnel = await prisma.funnel.upsert({
    where: { id: "seed-funnel-guide" },
    update: {},
    create: {
      id: "seed-funnel-guide",
      tenantId: tenant.id,
      name: "Free Guide Funnel",
      slug: "free-guide",
      description: "Sample funnel seeded for local end-to-end testing.",
      status: "PUBLISHED",
    },
  });

  await prisma.funnelStep.upsert({
    where: { id: "seed-step-landing" },
    update: {},
    create: {
      id: "seed-step-landing",
      funnelId: funnel.id,
      type: "LANDING",
      name: "Landing",
      slug: "start",
      order: 0,
      content: [
        { type: "heading", text: "Get the free Intrapreneurship Starter Guide" },
        { type: "text", body: "5 frameworks you can use at work this week — no fluff." },
        { type: "button", label: "Get the free guide", href: "/f/free-guide/opt-in" },
      ],
    },
  });

  await prisma.funnelStep.upsert({
    where: { id: "seed-step-optin" },
    update: {},
    create: {
      id: "seed-step-optin",
      funnelId: funnel.id,
      type: "OPT_IN",
      name: "Opt-in",
      slug: "opt-in",
      order: 1,
      content: [
        { type: "heading", text: "Where should we send it?" },
        { type: "form", fields: ["email", "firstName"], submitLabel: "Send me the guide" },
      ],
    },
  });

  await prisma.funnelStep.upsert({
    where: { id: "seed-step-offer" },
    update: {},
    create: {
      id: "seed-step-offer",
      funnelId: funnel.id,
      type: "OFFER",
      name: "Offer",
      slug: "offer",
      order: 2,
      content: [
        { type: "heading", text: "While you're here — go deeper" },
        {
          type: "text",
          body: "The guide is a start. Intrapreneurship Fundamentals is the full course, with video lessons and a certificate.",
        },
        { type: "buy", productId: "seed-product-intra-course", label: "Get the full course" },
      ],
    },
  });

  await prisma.funnelStep.upsert({
    where: { id: "seed-step-thankyou" },
    update: {},
    create: {
      id: "seed-step-thankyou",
      funnelId: funnel.id,
      type: "THANK_YOU",
      name: "Thank you",
      slug: "thank-you",
      order: 3,
      content: [
        { type: "heading", text: "You're all set" },
        { type: "text", body: "Check your email for the guide. See you inside." },
      ],
    },
  });

  console.log(`Sample funnel ready: ${funnel.name} (/t/${tenant.slug}/f/${funnel.slug}/start)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
