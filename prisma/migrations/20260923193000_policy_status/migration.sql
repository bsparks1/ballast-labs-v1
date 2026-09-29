-- Lifecycle is load-bearing: only status = 'active' is evaluated.
-- Existing rows stay active so policies already in a pack keep being checked.
ALTER TABLE "Policy" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
