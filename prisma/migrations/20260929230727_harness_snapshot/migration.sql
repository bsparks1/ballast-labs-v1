-- CreateTable
CREATE TABLE "HarnessSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "capturedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "instructions" JSONB NOT NULL,
    "tools" JSONB NOT NULL,
    "knowledge" JSONB NOT NULL,
    "memory" JSONB NOT NULL,
    "guardrails" JSONB NOT NULL,
    "delegation" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "HarnessSnapshot_snapshotId_key" ON "HarnessSnapshot"("snapshotId");

-- CreateIndex
CREATE INDEX "HarnessSnapshot_agentId_capturedAt_idx" ON "HarnessSnapshot"("agentId", "capturedAt");
