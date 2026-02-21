-- Add reminder hours preference for users
ALTER TABLE "User" ADD COLUMN "reminderHours" INTEGER NOT NULL DEFAULT 1;
