-- CreateEnum
CREATE TYPE "GtaInterviewStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'COMPLETED', 'MISSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "hasInterviews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "interviewWindowEnd" TIMESTAMP(3),
ADD COLUMN     "interviewWindowStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "interviewLocation" TEXT;

-- CreateTable
CREATE TABLE "GtaShift" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GtaShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GtaInterviewReservation" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gtaId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "GtaInterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GtaInterviewReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GtaShift_courseId_date_idx" ON "GtaShift"("courseId", "date");

-- CreateIndex
CREATE INDEX "GtaShift_userId_idx" ON "GtaShift"("userId");

-- CreateIndex
CREATE INDEX "GtaShift_courseId_userId_idx" ON "GtaShift"("courseId", "userId");

-- CreateIndex
CREATE INDEX "GtaInterviewReservation_assignmentId_studentId_idx" ON "GtaInterviewReservation"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "GtaInterviewReservation_gtaId_startTime_idx" ON "GtaInterviewReservation"("gtaId", "startTime");

-- CreateIndex
CREATE INDEX "GtaInterviewReservation_assignmentId_startTime_idx" ON "GtaInterviewReservation"("assignmentId", "startTime");

-- CreateIndex
CREATE INDEX "GtaInterviewReservation_status_startTime_idx" ON "GtaInterviewReservation"("status", "startTime");

-- AddForeignKey
ALTER TABLE "GtaShift" ADD CONSTRAINT "GtaShift_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GtaShift" ADD CONSTRAINT "GtaShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GtaInterviewReservation" ADD CONSTRAINT "GtaInterviewReservation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GtaInterviewReservation" ADD CONSTRAINT "GtaInterviewReservation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GtaInterviewReservation" ADD CONSTRAINT "GtaInterviewReservation_gtaId_fkey" FOREIGN KEY ("gtaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
