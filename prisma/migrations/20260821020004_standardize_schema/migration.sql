/*
  Warnings:

  - You are about to drop the `gradeTranslation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Assignment" DROP CONSTRAINT "Assignment_gradeTranslationId_fkey";

-- DropTable
DROP TABLE "public"."gradeTranslation";

-- CreateTable
CREATE TABLE "GradeTranslation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "mapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assignment_toolId_idx" ON "Assignment"("toolId");

-- CreateIndex
CREATE INDEX "Assignment_gradeTranslationId_idx" ON "Assignment"("gradeTranslationId");

-- CreateIndex
CREATE INDEX "Course_deploymentId_idx" ON "Course"("deploymentId");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");

-- CreateIndex
CREATE INDEX "LtiResult_userId_idx" ON "LtiResult"("userId");

-- CreateIndex
CREATE INDEX "LtiResult_assignmentId_idx" ON "LtiResult"("assignmentId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_gradeTranslationId_fkey" FOREIGN KEY ("gradeTranslationId") REFERENCES "GradeTranslation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
