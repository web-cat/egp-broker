-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "resourceLinkId" TEXT NOT NULL,
    "title" TEXT,
    "canvasAssignmentId" TEXT,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_courseId_resourceLinkId_key" ON "Assignment"("courseId", "resourceLinkId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
