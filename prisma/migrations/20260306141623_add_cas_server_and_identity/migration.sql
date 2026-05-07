-- CreateTable
CREATE TABLE "CasServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "serviceValidateVersion" TEXT NOT NULL DEFAULT '2.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "casServerId" TEXT NOT NULL,
    "casUsername" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CasServer_baseUrl_key" ON "CasServer"("baseUrl");

-- CreateIndex
CREATE UNIQUE INDEX "CasIdentity_casServerId_casUsername_key" ON "CasIdentity"("casServerId", "casUsername");

-- CreateIndex
CREATE UNIQUE INDEX "CasIdentity_userId_casServerId_key" ON "CasIdentity"("userId", "casServerId");

-- AddForeignKey
ALTER TABLE "CasIdentity" ADD CONSTRAINT "CasIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasIdentity" ADD CONSTRAINT "CasIdentity_casServerId_fkey" FOREIGN KEY ("casServerId") REFERENCES "CasServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
