-- Phase 9: tenant-scope Funnels, Academy, Marketing, and Orders/Billing.
-- Backfills existing rows onto the same legacy tenant Phase 8 created, so
-- this applies cleanly against a database with real seed/dev data already
-- in it. Also introduces TenantCustomer (a per-tenant Stripe Customer,
-- required once tenant revenue moves onto Stripe Connect) and drops the
-- now-unused global User.stripeCustomerId (no existing row had one set).

-- CreateTable
CREATE TABLE "TenantCustomer" (
    "id" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TenantCustomer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantCustomer_stripeCustomerId_key" ON "TenantCustomer"("stripeCustomerId");
CREATE UNIQUE INDEX "TenantCustomer_tenantId_userId_key" ON "TenantCustomer"("tenantId", "userId");

ALTER TABLE "TenantCustomer" ADD CONSTRAINT "TenantCustomer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantCustomer" ADD CONSTRAINT "TenantCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the old single-Stripe-account customer link (no row has one set —
-- verified before writing this migration; Stripe Connect customers live on
-- TenantCustomer instead).
ALTER TABLE "User" DROP COLUMN "stripeCustomerId";

-- AlterTable: add tenantId nullable, backfill onto the legacy tenant, then
-- enforce NOT NULL — required because these tables already hold rows.
ALTER TABLE "Funnel" ADD COLUMN "tenantId" TEXT;
UPDATE "Funnel" SET "tenantId" = 'tenant_default';
ALTER TABLE "Funnel" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Sequence" ADD COLUMN "tenantId" TEXT;
UPDATE "Sequence" SET "tenantId" = 'tenant_default';
ALTER TABLE "Sequence" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Course" ADD COLUMN "tenantId" TEXT;
UPDATE "Course" SET "tenantId" = 'tenant_default';
ALTER TABLE "Course" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Product" ADD COLUMN "tenantId" TEXT;
UPDATE "Product" SET "tenantId" = 'tenant_default';
ALTER TABLE "Product" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Order" ADD COLUMN "tenantId" TEXT;
UPDATE "Order" SET "tenantId" = 'tenant_default';
ALTER TABLE "Order" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Subscription" ADD COLUMN "tenantId" TEXT;
UPDATE "Subscription" SET "tenantId" = 'tenant_default';
ALTER TABLE "Subscription" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "SocialAccount" ADD COLUMN "tenantId" TEXT;
UPDATE "SocialAccount" SET "tenantId" = 'tenant_default';
ALTER TABLE "SocialAccount" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Campaign" ADD COLUMN "tenantId" TEXT;
UPDATE "Campaign" SET "tenantId" = 'tenant_default';
ALTER TABLE "Campaign" ALTER COLUMN "tenantId" SET NOT NULL;

-- DropIndex (superseded by tenant-scoped equivalents below)
DROP INDEX "Course_published_idx";
DROP INDEX "Course_slug_key";
DROP INDEX "Funnel_slug_key";

-- CreateIndex (tenant-scoped)
CREATE INDEX "Campaign_tenantId_idx" ON "Campaign"("tenantId");
CREATE INDEX "Course_tenantId_published_idx" ON "Course"("tenantId", "published");
CREATE UNIQUE INDEX "Course_tenantId_slug_key" ON "Course"("tenantId", "slug");
CREATE UNIQUE INDEX "Funnel_tenantId_slug_key" ON "Funnel"("tenantId", "slug");
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");
CREATE INDEX "Sequence_tenantId_idx" ON "Sequence"("tenantId");
CREATE INDEX "SocialAccount_tenantId_idx" ON "SocialAccount"("tenantId");
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
