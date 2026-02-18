-- CreateIndex
CREATE UNIQUE INDEX "TrainingSlot_trainerTgUserId_dateKey_start_end_key" ON "TrainingSlot"("trainerTgUserId", "dateKey", "start", "end");
