-- AlterTable
ALTER TABLE "CbtfFacility" ADD COLUMN     "checkInGraceMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "checkInLeadMinutes" INTEGER NOT NULL DEFAULT 5;
