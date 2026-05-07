/*
  Warnings:

  - A unique constraint covering the columns `[platformId,ltiSub]` on the table `LtiResult` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ltiSub` to the `LtiResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformId` to the `LtiResult` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LtiResult" ADD COLUMN     "deploymentId" TEXT,
ADD COLUMN     "ltiSub" TEXT NOT NULL,
ADD COLUMN     "platformId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LtiResult_platformId_ltiSub_key" ON "LtiResult"("platformId", "ltiSub");
