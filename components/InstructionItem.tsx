import type { Instruction } from "@/lib/types";

const TYPE_BADGE: Record<Instruction["type"], string> = {
  absolute: "bg-critical-dim text-critical",
  conditional: "bg-info-dim text-info",
  vague: "bg-warning-dim text-warning",
};

export function InstructionItem({ instruction }: { instruction: Instruction }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 w-12 shrink-0 font-mono text-[10px] text-faint">{instruction.id}</span>
      <p
        className={`flex-1 text-sm leading-relaxed ${
          instruction.isFossil ? "text-faint line-through decoration-critical/50" : "text-foreground"
        }`}
      >
        {instruction.text}
      </p>
      <span className="flex shrink-0 gap-1">
        <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${TYPE_BADGE[instruction.type]}`}>
          {instruction.type}
        </span>
        {instruction.isFossil && (
          <span className="rounded-sm bg-critical-dim px-1.5 py-0.5 font-mono text-[10px] text-critical">
            fossil
          </span>
        )}
      </span>
    </div>
  );
}
