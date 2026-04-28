/*
  Warnings:

  - You are about to drop the column `canvasAgsEndpoint` on the `Assignment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "canvasAgsEndpoint";

-- CreateTable
CREATE TABLE "LtiResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "lisResultSourcedId" TEXT,
    "lisOutcomeServiceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LtiResult_userId_assignmentId_key" ON "LtiResult"("userId", "assignmentId");

-- AddForeignKey
ALTER TABLE "LtiResult" ADD CONSTRAINT "LtiResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiResult" ADD CONSTRAINT "LtiResult_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
