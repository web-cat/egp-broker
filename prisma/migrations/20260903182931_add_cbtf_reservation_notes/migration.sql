-- CreateTable
CREATE TABLE "CbtfReservationNote" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hasPhotos" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbtfReservationNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CbtfReservationNote_reservationId_idx" ON "CbtfReservationNote"("reservationId");

-- CreateIndex
CREATE INDEX "CbtfReservationNote_authorId_idx" ON "CbtfReservationNote"("authorId");

-- AddForeignKey
ALTER TABLE "CbtfReservationNote" ADD CONSTRAINT "CbtfReservationNote_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "CbtfReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbtfReservationNote" ADD CONSTRAINT "CbtfReservationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
