-- Phase 8: multi-tenancy foundation.
-- Introduces Tenant/Membership/PlatformSubscription and scopes the CRM
-- module (Contact/Company/Pipeline/Deal/Task/Note/Activity) to a tenant.
-- Existing rows are backfilled onto one default Tenant ("Intra Success
-- Academy") so this is safe to run against a database that already has
-- Phase 1-7 data in it (dev/seed data, not a real production tenant yet).

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'CUSTOMER');
CREATE TYPE "StripeConnectStatus" AS ENUM ('NOT_CONNECTED', 'PENDING', 'ACTIVE', 'RESTRICTED');
CREATE TYPE "PlatformPlan" AS ENUM ('TRIAL', 'STANDARD');
CREATE TYPE "PlatformSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeConnectAccountId" TEXT,
    "stripeConnectStatus" "StripeConnectStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSubscription" (
    "id" TEXT NOT NULL,
    "plan" "PlatformPlan" NOT NULL DEFAULT 'TRIAL',
    "status" "PlatformSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "Tenant_stripeConnectAccountId_key" ON "Tenant"("stripeConnectAccountId");
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");
CREATE UNIQUE INDEX "PlatformSubscription_stripeSubscriptionId_key" ON "PlatformSubscription"("stripeSubscriptionId");
CREATE UNIQUE INDEX "PlatformSubscription_tenantId_key" ON "PlatformSubscription"("tenantId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformSubscription" ADD CONSTRAINT "PlatformSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one default Tenant for every row that predates multi-tenancy,
-- with a trialing platform subscription so it behaves like any new signup.
INSERT INTO "Tenant" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('tenant_default', 'Intra Success Academy', 'intra-success-academy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "PlatformSubscription" ("id", "tenantId", "plan", "status", "trialEndsAt", "createdAt", "updatedAt")
VALUES ('platsub_default', 'tenant_default', 'TRIAL', 'TRIALING', CURRENT_TIMESTAMP + INTERVAL '14 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: User.role -> User.isPlatformAdmin + a Membership per user.
-- The old ADMIN role becomes both a platform admin AND the default
-- Tenant's OWNER (they were the sole operator of the whole single-tenant
-- app, so they own its data going forward as a tenant too).
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "isPlatformAdmin" = true WHERE "role" = 'ADMIN';

INSERT INTO "Membership" ("id", "userId", "tenantId", "role", "createdAt")
SELECT 'mem_' || "id", "id", 'tenant_default',
  CASE "role" WHEN 'ADMIN' THEN 'OWNER'::"MembershipRole" ELSE "role"::text::"MembershipRole" END,
  CURRENT_TIMESTAMP
FROM "User";

DROP INDEX "User_role_idx";
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";
CREATE INDEX "User_isPlatformAdmin_idx" ON "User"("isPlatformAdmin");

-- AlterTable: add tenantId nullable, backfill onto the default Tenant, then
-- enforce NOT NULL — required because these tables already hold rows.
ALTER TABLE "Company" ADD COLUMN "tenantId" TEXT;
UPDATE "Company" SET "tenantId" = 'tenant_default';
ALTER TABLE "Company" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Contact" ADD COLUMN "tenantId" TEXT;
UPDATE "Contact" SET "tenantId" = 'tenant_default';
ALTER TABLE "Contact" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Pipeline" ADD COLUMN "tenantId" TEXT;
UPDATE "Pipeline" SET "tenantId" = 'tenant_default';
ALTER TABLE "Pipeline" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Deal" ADD COLUMN "tenantId" TEXT;
UPDATE "Deal" SET "tenantId" = 'tenant_default';
ALTER TABLE "Deal" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Task" ADD COLUMN "tenantId" TEXT;
UPDATE "Task" SET "tenantId" = 'tenant_default';
ALTER TABLE "Task" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Note" ADD COLUMN "tenantId" TEXT;
UPDATE "Note" SET "tenantId" = 'tenant_default';
ALTER TABLE "Note" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Activity" ADD COLUMN "tenantId" TEXT;
UPDATE "Activity" SET "tenantId" = 'tenant_default';
ALTER TABLE "Activity" ALTER COLUMN "tenantId" SET NOT NULL;

-- DropIndex (superseded by tenant-scoped equivalents below)
DROP INDEX "Company_name_idx";
DROP INDEX "Contact_email_key";

-- CreateIndex (tenant-scoped)
CREATE INDEX "Company_tenantId_name_idx" ON "Company"("tenantId", "name");
CREATE UNIQUE INDEX "Contact_tenantId_email_key" ON "Contact"("tenantId", "email");
CREATE INDEX "Pipeline_tenantId_idx" ON "Pipeline"("tenantId");
CREATE INDEX "Deal_tenantId_idx" ON "Deal"("tenantId");
CREATE INDEX "Task_tenantId_idx" ON "Task"("tenantId");
CREATE INDEX "Note_tenantId_idx" ON "Note"("tenantId");
CREATE INDEX "Activity_tenantId_createdAt_idx" ON "Activity"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
