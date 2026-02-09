/*
  Warnings:

  - You are about to drop the `Token` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `LtiDeployment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Course" DROP CONSTRAINT "Course_deploymentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Token" DROP CONSTRAINT "Token_userId_fkey";

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "acceptUntil" TIMESTAMP(3),
ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "dueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "deploymentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LtiDeployment" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "public"."Token";

-- DropEnum
DROP TYPE "public"."TokenType";

-- CreateTable
CREATE TABLE "TokenType" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "extensionOnly" BOOLEAN NOT NULL DEFAULT false,
    "initialBalance" INTEGER NOT NULL DEFAULT 3,
    "allowRequests" BOOLEAN NOT NULL DEFAULT false,
    "hoursPerToken" DOUBLE PRECISION NOT NULL DEFAULT 24,
    "minDaysPastDue" INTEGER,
    "maxDaysPastDue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenEligibility" (
    "id" TEXT NOT NULL,
    "tokenTypeId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "titlePattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPrompt" (
    "id" TEXT NOT NULL,
    "tokenTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "choicesJson" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentTokenPool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenTypeId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentTokenPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRedemption" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "tokensCost" INTEGER NOT NULL DEFAULT 1,
    "availableFrom" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "acceptUntil" TIMESTAMP(3),
    "promptResponsesJson" JSONB,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenType_courseId_idx" ON "TokenType"("courseId");

-- CreateIndex
CREATE INDEX "TokenEligibility_tokenTypeId_idx" ON "TokenEligibility"("tokenTypeId");

-- CreateIndex
CREATE INDEX "TokenPrompt_tokenTypeId_idx" ON "TokenPrompt"("tokenTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTokenPool_userId_tokenTypeId_key" ON "StudentTokenPool"("userId", "tokenTypeId");

-- CreateIndex
CREATE INDEX "TokenRedemption_poolId_idx" ON "TokenRedemption"("poolId");

-- CreateIndex
CREATE INDEX "TokenRedemption_assignmentId_idx" ON "TokenRedemption"("assignmentId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "LtiDeployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenType" ADD CONSTRAINT "TokenType_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenEligibility" ADD CONSTRAINT "TokenEligibility_tokenTypeId_fkey" FOREIGN KEY ("tokenTypeId") REFERENCES "TokenType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenEligibility" ADD CONSTRAINT "TokenEligibility_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPrompt" ADD CONSTRAINT "TokenPrompt_tokenTypeId_fkey" FOREIGN KEY ("tokenTypeId") REFERENCES "TokenType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTokenPool" ADD CONSTRAINT "StudentTokenPool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTokenPool" ADD CONSTRAINT "StudentTokenPool_tokenTypeId_fkey" FOREIGN KEY ("tokenTypeId") REFERENCES "TokenType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenRedemption" ADD CONSTRAINT "TokenRedemption_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "StudentTokenPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenRedemption" ADD CONSTRAINT "TokenRedemption_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
