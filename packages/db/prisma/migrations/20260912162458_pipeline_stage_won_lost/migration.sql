-- AlterTable
ALTER TABLE "PipelineStage" ADD COLUMN     "isLost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isWon" BOOLEAN NOT NULL DEFAULT false;
