-- AlterTable
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "LtiPlatform" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authEndpoint" TEXT NOT NULL,
    "tokenEndpoint" TEXT NOT NULL,
    "jwksEndpoint" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiDeployment" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,

    CONSTRAINT "LtiDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LtiIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "ltiSub" TEXT NOT NULL,
    "deploymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LtiIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LtiPlatform_issuer_key" ON "LtiPlatform"("issuer");

-- CreateIndex
CREATE UNIQUE INDEX "LtiDeployment_platformId_deploymentId_key" ON "LtiDeployment"("platformId", "deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "LtiIdentity_platformId_ltiSub_key" ON "LtiIdentity"("platformId", "ltiSub");

-- AddForeignKey
ALTER TABLE "LtiDeployment" ADD CONSTRAINT "LtiDeployment_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LtiPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiIdentity" ADD CONSTRAINT "LtiIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiIdentity" ADD CONSTRAINT "LtiIdentity_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LtiPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LtiIdentity" ADD CONSTRAINT "LtiIdentity_platformId_deploymentId_fkey" FOREIGN KEY ("platformId", "deploymentId") REFERENCES "LtiDeployment"("platformId", "deploymentId") ON DELETE RESTRICT ON UPDATE CASCADE;
