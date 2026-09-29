import type { PolicyRecord, PolicyVersionRecord } from "@/lib/db/types";
import type { Policy } from "@/lib/types";

export function toPolicy(record: PolicyRecord): Policy {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    statement: record.statement,
    checkableIntent: record.checkableIntent,
    components: record.components,
    frameworks: record.frameworks,
    severity: record.severity,
    source: record.source,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    version: record.version,
    code: record.code,
    principle: record.principle,
    checker: record.checker,
    adoptedFromId: record.adoptedFromId,
    status: record.status,
    confidence: record.confidence,
    generationNote: record.generationNote,
  };
}

export function versionToPolicy(record: PolicyRecord, version: PolicyVersionRecord): Policy {
  return {
    ...toPolicy(record),
    statement: version.statement,
    checkableIntent: version.checkableIntent,
    components: version.components,
    frameworks: version.frameworks,
    severity: version.severity,
    source: version.source,
    createdBy: version.createdBy,
    createdAt: version.createdAt.toISOString(),
    version: version.versionNumber,
    checker: version.checker,
    confidence: version.confidence,
    generationNote: version.generationNote,
  };
}
