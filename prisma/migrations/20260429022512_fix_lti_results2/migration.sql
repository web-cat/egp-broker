/*
  Warnings:

  - A unique constraint covering the columns `[platformId,ltiSub,assignmentId]` on the table `LtiResult` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."LtiResult_platformId_ltiSub_key";

-- DropIndex
DROP INDEX "public"."LtiResult_userId_assignmentId_key";

-- CreateIndex
CREATE UNIQUE INDEX "LtiResult_platformId_ltiSub_assignmentId_key" ON "LtiResult"("platformId", "ltiSub", "assignmentId");
