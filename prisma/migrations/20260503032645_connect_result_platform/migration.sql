-- AddForeignKey
ALTER TABLE "LtiResult" ADD CONSTRAINT "LtiResult_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "LtiPlatform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
