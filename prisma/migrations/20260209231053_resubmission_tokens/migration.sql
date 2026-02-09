/*
  Warnings:

  - Added the required column `updatedAt` to the `LtiDeployment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Course" DROP CONSTRAINT "Course_deploymentId_fkey";

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "acceptUntil" TIMESTAMP(3),
ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "dueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "deploymentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LtiDeployment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "PassType" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "extensionOnly" BOOLEAN NOT NULL DEFAULT false,
    "initialBalance" INTEGER NOT NULL DEFAULT 3,
    "allowRequests" BOOLEAN NOT NULL DEFAULT false,
    "hoursPerPass" DOUBLE PRECISION NOT NULL DEFAULT 24,
    "minDaysPastDue" INTEGER,
    "maxDaysPastDue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassEligibility" (
    "id" TEXT NOT NULL,
    "passTypeId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "titlePattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassPrompt" (
    "id" TEXT NOT NULL,
    "passTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "choicesJson" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPassPool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passTypeId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPassPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassRedemption" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 1,
    "availableFrom" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "acceptUntil" TIMESTAMP(3),
    "promptResponsesJson" JSONB,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PassType_courseId_idx" ON "PassType"("courseId");

-- CreateIndex
CREATE INDEX "PassEligibility_passTypeId_idx" ON "PassEligibility"("passTypeId");

-- CreateIndex
CREATE INDEX "PassPrompt_passTypeId_idx" ON "PassPrompt"("passTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPassPool_userId_passTypeId_key" ON "StudentPassPool"("userId", "passTypeId");

-- CreateIndex
CREATE INDEX "PassRedemption_poolId_idx" ON "PassRedemption"("poolId");

-- CreateIndex
CREATE INDEX "PassRedemption_assignmentId_idx" ON "PassRedemption"("assignmentId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "LtiDeployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassType" ADD CONSTRAINT "PassType_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassEligibility" ADD CONSTRAINT "PassEligibility_passTypeId_fkey" FOREIGN KEY ("passTypeId") REFERENCES "PassType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassEligibility" ADD CONSTRAINT "PassEligibility_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassPrompt" ADD CONSTRAINT "PassPrompt_passTypeId_fkey" FOREIGN KEY ("passTypeId") REFERENCES "PassType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPassPool" ADD CONSTRAINT "StudentPassPool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPassPool" ADD CONSTRAINT "StudentPassPool_passTypeId_fkey" FOREIGN KEY ("passTypeId") REFERENCES "PassType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassRedemption" ADD CONSTRAINT "PassRedemption_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "StudentPassPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassRedemption" ADD CONSTRAINT "PassRedemption_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
