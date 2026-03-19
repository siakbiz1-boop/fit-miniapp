-- Add color to TrainingSession
ALTER TABLE "TrainingSession" ADD COLUMN IF NOT EXISTS "color" TEXT;
