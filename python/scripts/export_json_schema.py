#!/usr/bin/env python3
"""Export HarnessSnapshot JSON Schema to schemas/harness_snapshot.schema.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python" / "src"))

from ballast.schema import HarnessSnapshot  # noqa: E402

OUT = ROOT / "schemas" / "harness_snapshot.schema.json"


def main() -> None:
    schema = HarnessSnapshot.model_json_schema(mode="serialization")
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["title"] = "HarnessSnapshot"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
