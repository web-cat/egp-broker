-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "gradeTranslationId" TEXT;

-- CreateTable
CREATE TABLE "gradeTranslation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gradeTranslation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_gradeTranslationId_fkey" FOREIGN KEY ("gradeTranslationId") REFERENCES "gradeTranslation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
