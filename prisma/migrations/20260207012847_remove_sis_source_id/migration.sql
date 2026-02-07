/*
  Warnings:

  - You are about to drop the column `sisSourceId` on the `Course` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Course_sisSourceId_idx";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "sisSourceId";
