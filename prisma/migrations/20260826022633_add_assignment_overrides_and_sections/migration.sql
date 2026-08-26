-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "courseSectionId" TEXT;

-- AlterTable
ALTER TABLE "PassRedemption" ADD COLUMN     "canvasOverrideId" TEXT;

-- CreateTable
CREATE TABLE "CourseSection" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "canvasSectionId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentOverride" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "canvasOverrideId" TEXT,
    "title" TEXT,
    "availableFrom" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "acceptUntil" TIMESTAMP(3),
    "courseSectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentOverrideStudent" (
    "id" TEXT NOT NULL,
    "overrideId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentOverrideStudent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseSection_courseId_idx" ON "CourseSection"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSection_courseId_canvasSectionId_key" ON "CourseSection"("courseId", "canvasSectionId");

-- CreateIndex
CREATE INDEX "AssignmentOverride_assignmentId_idx" ON "AssignmentOverride"("assignmentId");

-- CreateIndex
CREATE INDEX "AssignmentOverride_courseSectionId_idx" ON "AssignmentOverride"("courseSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentOverride_assignmentId_canvasOverrideId_key" ON "AssignmentOverride"("assignmentId", "canvasOverrideId");

-- CreateIndex
CREATE INDEX "AssignmentOverrideStudent_userId_idx" ON "AssignmentOverrideStudent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentOverrideStudent_overrideId_userId_key" ON "AssignmentOverrideStudent"("overrideId", "userId");

-- CreateIndex
CREATE INDEX "Enrollment_courseSectionId_idx" ON "Enrollment"("courseSectionId");

-- CreateIndex
CREATE INDEX "PassRedemption_canvasOverrideId_idx" ON "PassRedemption"("canvasOverrideId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "CourseSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentOverride" ADD CONSTRAINT "AssignmentOverride_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentOverride" ADD CONSTRAINT "AssignmentOverride_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "CourseSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentOverrideStudent" ADD CONSTRAINT "AssignmentOverrideStudent_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "AssignmentOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentOverrideStudent" ADD CONSTRAINT "AssignmentOverrideStudent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
