-- CreateEnum
CREATE TYPE "PassPortRegistrationStatus" AS ENUM ('NOT_REGISTERED', 'PENDING', 'REGISTERED', 'FAILED');

-- AlterTable
ALTER TABLE "LtiTool" ADD COLUMN     "passportClientId" TEXT,
ADD COLUMN     "passportClientSecret" TEXT,
ADD COLUMN     "passportExtensionUrl" TEXT,
ADD COLUMN     "passportRegisteredAt" TIMESTAMP(3),
ADD COLUMN     "passportRegistrationError" TEXT,
ADD COLUMN     "passportRegistrationStatus" "PassPortRegistrationStatus" NOT NULL DEFAULT 'NOT_REGISTERED',
ADD COLUMN     "passportRegistrationToken" TEXT,
ADD COLUMN     "passportRegistrationUrl" TEXT,
ADD COLUMN     "passportRequestedProperties" JSONB,
ADD COLUMN     "supportsPassport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsProxy" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "LtiTool_passportRegistrationToken_key" ON "LtiTool"("passportRegistrationToken");

-- CreateIndex
CREATE INDEX "LtiTool_passportRegistrationStatus_idx" ON "LtiTool"("passportRegistrationStatus");
