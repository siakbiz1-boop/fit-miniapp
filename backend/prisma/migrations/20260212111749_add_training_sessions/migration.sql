-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "trainerTgUserId" BIGINT NOT NULL,
    "clientUsername" TEXT NOT NULL,
    "clientName" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "type" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingSession_trainerTgUserId_startAt_idx" ON "TrainingSession"("trainerTgUserId", "startAt");

-- CreateIndex
CREATE INDEX "TrainingSession_remindAt_idx" ON "TrainingSession"("remindAt");
