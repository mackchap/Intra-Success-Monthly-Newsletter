-- CreateEnum
CREATE TYPE "ListingTier" AS ENUM ('FREE', 'FEATURED', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'LISTING_UPGRADE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "listingId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "listingId" TEXT;

-- CreateTable
CREATE TABLE "Directory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Directory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectoryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "directoryId" TEXT NOT NULL,

    CONSTRAINT "DirectoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "email" TEXT,
    "hours" JSONB,
    "photos" JSONB,
    "tier" "ListingTier" NOT NULL DEFAULT 'FREE',
    "status" "ListingStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "directoryId" TEXT NOT NULL,
    "categoryId" TEXT,
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Directory_tenantId_key" ON "Directory"("tenantId");

-- CreateIndex
CREATE INDEX "DirectoryCategory_directoryId_idx" ON "DirectoryCategory"("directoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryCategory_directoryId_slug_key" ON "DirectoryCategory"("directoryId", "slug");

-- CreateIndex
CREATE INDEX "Listing_tenantId_idx" ON "Listing"("tenantId");

-- CreateIndex
CREATE INDEX "Listing_directoryId_status_idx" ON "Listing"("directoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_directoryId_slug_key" ON "Listing"("directoryId", "slug");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Directory" ADD CONSTRAINT "Directory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectoryCategory" ADD CONSTRAINT "DirectoryCategory_directoryId_fkey" FOREIGN KEY ("directoryId") REFERENCES "Directory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_directoryId_fkey" FOREIGN KEY ("directoryId") REFERENCES "Directory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DirectoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

