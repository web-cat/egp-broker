/*
  Warnings:

  - A unique constraint covering the columns `[userId,platformId]` on the table `LtiIdentity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LtiIdentity_userId_platformId_key" ON "LtiIdentity"("userId", "platformId");
