-- Generator confidence and the coaching note travel with the policy version.
-- Empty confidence means the version was not produced by the guided generator.
ALTER TABLE "PolicyVersion" ADD COLUMN "confidence" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PolicyVersion" ADD COLUMN "generationNote" TEXT NOT NULL DEFAULT '';
