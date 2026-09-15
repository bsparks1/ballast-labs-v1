/** Quick smoke test for defensive JSON parsing in Layer B. Run: npx tsx scripts/test-parsing.ts */
import { extractJson } from "../lib/analysis/conflicts";

const cases: [string, string][] = [
  ["plain", '{"candidates":[]}'],
  [
    "fenced",
    '```json\n{"candidates":[{"a":"ins-1","b":"ins-2","trigger":"t","reason":"r","severity":"critical"}]}\n```',
  ],
  [
    "prose-wrapped",
    'Here is the result:\n{"verdict":"verified","explanation":"e","recommendation":"rec"}\nHope that helps!',
  ],
  ["garbage", "I cannot analyze this."],
  ["truncated", '{"candidates":[{"a":"ins-1"'],
];

let failed = 0;
for (const [name, raw] of cases) {
  const result = extractJson(raw);
  const expectNull = name === "garbage" || name === "truncated";
  const ok = expectNull ? result === null : result !== null;
  if (!ok) failed += 1;
  console.log(ok ? "PASS" : "FAIL", name, "=>", JSON.stringify(result));
}
process.exit(failed > 0 ? 1 : 0);
