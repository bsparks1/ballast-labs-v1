import type { Finding } from "@/lib/types";

let seq = 0;

export function resetFindingIds(): void {
  seq = 0;
}

export function makeFinding(f: Omit<Finding, "id">): Finding {
  seq += 1;
  return { id: `f-${f.category}-${seq}`, ...f };
}
