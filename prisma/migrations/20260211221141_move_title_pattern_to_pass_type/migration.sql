/*
  Warnings:

  - You are about to drop the column `titlePattern` on the `PassEligibility` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PassEligibility" DROP COLUMN "titlePattern";

-- AlterTable
ALTER TABLE "PassType" ADD COLUMN     "titlePattern" TEXT,
ADD COLUMN     "usePattern" BOOLEAN NOT NULL DEFAULT false;
