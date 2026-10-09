-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "cbtfDurationMinutes" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "CbtfFacility" ADD COLUMN     "elasticSeatCount" INTEGER NOT NULL DEFAULT 2;
