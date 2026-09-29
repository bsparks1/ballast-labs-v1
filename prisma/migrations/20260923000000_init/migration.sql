-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Harness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastViewedAt" DATETIME,
    CONSTRAINT "Harness_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HarnessVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "harnessId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "rawPrompt" TEXT NOT NULL,
    "rawConfig" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "HarnessVersion_harnessId_fkey" FOREIGN KEY ("harnessId") REFERENCES "Harness" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "harnessVersionId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "componentReports" JSONB NOT NULL,
    "findings" JSONB NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalysisResult_harnessVersionId_fkey" FOREIGN KEY ("harnessVersionId") REFERENCES "HarnessVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "code" TEXT NOT NULL,
    "principle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adoptedFromId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Policy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "statement" TEXT NOT NULL,
    "checkableIntent" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "frameworks" JSONB NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "checker" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "PolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "harnessVersionId" TEXT NOT NULL,
    "policyPackVersion" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "delta" JSONB,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceReport_harnessVersionId_fkey" FOREIGN KEY ("harnessVersionId") REFERENCES "HarnessVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Harness_userId_idx" ON "Harness"("userId");

-- CreateIndex
CREATE INDEX "HarnessVersion_harnessId_idx" ON "HarnessVersion"("harnessId");

-- CreateIndex
CREATE UNIQUE INDEX "HarnessVersion_harnessId_versionNumber_key" ON "HarnessVersion"("harnessId", "versionNumber");

-- CreateIndex
CREATE INDEX "AnalysisResult_harnessVersionId_createdAt_idx" ON "AnalysisResult"("harnessVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "Policy_userId_idx" ON "Policy"("userId");

-- CreateIndex
CREATE INDEX "Policy_code_idx" ON "Policy"("code");

-- CreateIndex
CREATE INDEX "PolicyVersion_policyId_idx" ON "PolicyVersion"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_policyId_versionNumber_key" ON "PolicyVersion"("policyId", "versionNumber");

-- CreateIndex
CREATE INDEX "ComplianceReport_harnessVersionId_generatedAt_idx" ON "ComplianceReport"("harnessVersionId", "generatedAt");

