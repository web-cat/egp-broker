-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentCourseId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentCourseId_fkey" FOREIGN KEY ("currentCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
