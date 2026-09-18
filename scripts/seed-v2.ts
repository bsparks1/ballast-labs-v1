/**
 * Seeds a demo user with a three-version harness so the dashboard, diff,
 * and timeline can be reviewed without waiting on live model calls.
 */
import { PrismaClient } from "@prisma/client";
import { analyzeHarness } from "../lib/analysis/engine";
import { hashPassword } from "../lib/auth/password";
import { KNOWN_BAD_PROMPT, KNOWN_GOOD_PROMPT } from "../lib/analysis/__tests__/fixtures";

const DEMO_EMAIL = "demo@ballast.local";
const prisma = new PrismaClient();

async function persist(versionId: string, prompt: string) {
  const report = await analyzeHarness(prompt, undefined, { modelAvailable: false });
  return prisma.analysisResult.create({
    data: {
      harnessVersionId: versionId,
      overallScore: report.overallHealthScore,
      componentReports: report.components,
      findings: report.components.flatMap((c) => c.findings),
      meta: { ...report.meta, passes: report.passes },
    },
  });
}

async function main() {
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: DEMO_EMAIL, passwordHash: await hashPassword("demo") },
    });
  }

  const existing = await prisma.harness.findFirst({
    where: { userId: user.id, name: "Customer Support Agent" },
  });
  if (existing) {
    console.log("Demo harness already exists:", existing.id);
    return;
  }

  const harness = await prisma.harness.create({
    data: {
      userId: user.id,
      name: "Customer Support Agent",
      description: "Meridian support agent tracked across config changes.",
    },
  });

  const v1 = await prisma.harnessVersion.create({
    data: {
      harnessId: harness.id,
      versionNumber: 1,
      rawPrompt: KNOWN_GOOD_PROMPT,
      note: "Initial governed prompt",
    },
  });
  const a1 = await persist(v1.id, KNOWN_GOOD_PROMPT);

  const v2 = await prisma.harnessVersion.create({
    data: {
      harnessId: harness.id,
      versionNumber: 2,
      rawPrompt: KNOWN_BAD_PROMPT,
      note: "added refund autonomy and transfer conflict",
    },
  });
  const a2 = await persist(v2.id, KNOWN_BAD_PROMPT);

  const v3 = await prisma.harnessVersion.create({
    data: {
      harnessId: harness.id,
      versionNumber: 3,
      rawPrompt: KNOWN_GOOD_PROMPT,
      note: "restored identity check and refund cap",
    },
  });
  const a3 = await persist(v3.id, KNOWN_GOOD_PROMPT);

  await prisma.harness.update({
    where: { id: harness.id },
    data: { updatedAt: new Date() },
  });

  console.log(
    JSON.stringify(
      {
        harnessId: harness.id,
        scores: [a1.overallScore, a2.overallScore, a3.overallScore],
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
