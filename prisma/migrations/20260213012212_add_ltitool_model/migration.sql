-- CreateEnum
CREATE TYPE "Protocol" AS ENUM ('LTI11', 'LTI13', 'SPLICE');

-- CreateTable
CREATE TABLE "LtiTool" (
    "id" TEXT NOT NULL,
    "platformId" TEXT,
    "name" TEXT,
    "baseUrl" TEXT NOT NULL,
    "protocol" "Protocol" NOT NULL,
    "key" TEXT,
    "secret" TEXT,
    "supportsExtensionApi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiTool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LtiTool_platformId_idx" ON "LtiTool"("platformId");

-- AddForeignKey
ALTER TABLE "LtiTool" ADD CONSTRAINT "LtiTool_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LtiPlatform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
