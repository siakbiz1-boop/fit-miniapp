-- CreateTable
CREATE TABLE "ClientExerciseHistory" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientExerciseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientExerciseHistory_clientId_exerciseId_recordedAt_idx" ON "ClientExerciseHistory"("clientId", "exerciseId", "recordedAt");

-- AddForeignKey
ALTER TABLE "ClientExerciseHistory" ADD CONSTRAINT "ClientExerciseHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TrainerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientExerciseHistory" ADD CONSTRAINT "ClientExerciseHistory_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ClientExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
