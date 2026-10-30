-- AlterTable
ALTER TABLE "GtaInterviewReservation" ADD COLUMN     "submissionStatus" JSONB,
ADD COLUMN     "submissionStatusCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LtiTool" ADD COLUMN     "passportStatusUrl" TEXT;
