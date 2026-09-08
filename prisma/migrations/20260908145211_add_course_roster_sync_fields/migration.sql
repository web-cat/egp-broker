-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isRosterSyncing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastRosterSyncAt" TIMESTAMP(3),
ADD COLUMN     "nrpsContextMembershipsUrl" TEXT;
