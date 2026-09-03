-- CreateEnum
CREATE TYPE "CbtfReservationStatus" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'COMPLETED', 'MISSED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "GlobalRole" ADD VALUE 'PROCTOR';

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "isSchedulable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduleWindowEnd" TIMESTAMP(3),
ADD COLUMN     "scheduleWindowStart" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "studentId" TEXT;

-- CreateTable
CREATE TABLE "CbtfFacility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Main CBTF',
    "totalSeats" INTEGER NOT NULL DEFAULT 50,
    "seatAllocationOrder" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtfFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtfOperatingHours" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtfOperatingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtfScheduleException" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtfScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtfProctorShift" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtfProctorShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbtfReservation" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "CbtfReservationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "checkedInByUserId" TEXT,
    "checkedOutByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtfReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CbtfOperatingHours_facilityId_idx" ON "CbtfOperatingHours"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "CbtfOperatingHours_facilityId_dayOfWeek_key" ON "CbtfOperatingHours"("facilityId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "CbtfScheduleException_facilityId_date_idx" ON "CbtfScheduleException"("facilityId", "date");

-- CreateIndex
CREATE INDEX "CbtfProctorShift_facilityId_date_idx" ON "CbtfProctorShift"("facilityId", "date");

-- CreateIndex
CREATE INDEX "CbtfProctorShift_userId_idx" ON "CbtfProctorShift"("userId");

-- CreateIndex
CREATE INDEX "CbtfReservation_facilityId_startTime_idx" ON "CbtfReservation"("facilityId", "startTime");

-- CreateIndex
CREATE INDEX "CbtfReservation_assignmentId_userId_idx" ON "CbtfReservation"("assignmentId", "userId");

-- CreateIndex
CREATE INDEX "CbtfReservation_userId_status_idx" ON "CbtfReservation"("userId", "status");

-- CreateIndex
CREATE INDEX "CbtfReservation_status_startTime_idx" ON "CbtfReservation"("status", "startTime");

-- CreateIndex
CREATE INDEX "CbtfReservation_seatNumber_startTime_idx" ON "CbtfReservation"("seatNumber", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- CreateIndex
CREATE INDEX "User_studentId_idx" ON "User"("studentId");

-- AddForeignKey
ALTER TABLE "CbtfOperatingHours" ADD CONSTRAINT "CbtfOperatingHours_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "CbtfFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtfScheduleException" ADD CONSTRAINT "CbtfScheduleException_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "CbtfFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtfProctorShift" ADD CONSTRAINT "CbtfProctorShift_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "CbtfFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtfProctorShift" ADD CONSTRAINT "CbtfProctorShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtfReservation" ADD CONSTRAINT "CbtfReservation_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "CbtfFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtfReservation" ADD CONSTRAINT "CbtfReservation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtfReservation" ADD CONSTRAINT "CbtfReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
