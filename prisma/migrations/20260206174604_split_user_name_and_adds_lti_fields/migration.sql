/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - Added the required column `firstName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('ADMIN', 'INSTRUCTOR', 'USER');

-- AlterTable
ALTER TABLE "LtiDeployment" ADD COLUMN     "deploymentHost" TEXT;

-- AlterTable
ALTER TABLE "LtiIdentity" ADD COLUMN     "platformApiKey" TEXT,
ADD COLUMN     "platformUserId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "lastName" TEXT NOT NULL;
