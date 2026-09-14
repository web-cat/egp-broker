-- AlterTable
ALTER TABLE "CbtfReservation" ADD COLUMN     "canvasOverrideId" TEXT;

-- CreateIndex
CREATE INDEX "CbtfReservation_canvasOverrideId_idx" ON "CbtfReservation"("canvasOverrideId");
