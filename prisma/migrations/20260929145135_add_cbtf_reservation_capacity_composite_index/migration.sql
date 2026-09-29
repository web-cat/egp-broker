-- CreateIndex
CREATE INDEX "CbtfReservation_facilityId_status_startTime_endTime_idx" ON "CbtfReservation"("facilityId", "status", "startTime", "endTime");
