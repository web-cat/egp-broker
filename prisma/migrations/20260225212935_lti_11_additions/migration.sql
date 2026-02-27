-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "toolId" TEXT;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "LtiTool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
