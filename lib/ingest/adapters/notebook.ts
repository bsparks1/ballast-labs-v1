/** Flatten an .ipynb notebook into concatenated cell source for pattern extraction. */

export function notebookToSource(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { cells?: unknown };
    if (!Array.isArray(parsed.cells)) return raw;
    const chunks: string[] = [];
    for (const cell of parsed.cells) {
      if (!cell || typeof cell !== "object") continue;
      const rec = cell as { cell_type?: unknown; source?: unknown };
      if (rec.cell_type !== "code" && rec.cell_type !== "markdown") continue;
      if (typeof rec.source === "string") chunks.push(rec.source);
      else if (Array.isArray(rec.source)) chunks.push(rec.source.filter((s) => typeof s === "string").join(""));
    }
    return chunks.join("\n\n");
  } catch {
    return raw;
  }
}
