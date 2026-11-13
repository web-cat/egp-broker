-- CreateTable
CREATE TABLE "StudentAssignmentNotice" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "notice" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAssignmentNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentAssignmentNotice_assignmentId_idx" ON "StudentAssignmentNotice"("assignmentId");

-- CreateIndex
CREATE INDEX "StudentAssignmentNotice_studentId_idx" ON "StudentAssignmentNotice"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAssignmentNotice_assignmentId_studentId_key" ON "StudentAssignmentNotice"("assignmentId", "studentId");

-- AddForeignKey
ALTER TABLE "StudentAssignmentNotice" ADD CONSTRAINT "StudentAssignmentNotice_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssignmentNotice" ADD CONSTRAINT "StudentAssignmentNotice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAssignmentNotice" ADD CONSTRAINT "StudentAssignmentNotice_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
