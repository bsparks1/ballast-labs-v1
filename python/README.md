# Ballast Python SDK

Runtime harness capture: emit `HarnessSnapshot` JSON to the Next.js collector.

## Install

```bash
cd python
pip install -e ".[dev]"
```

## Dogfood

With `npm run dev` running in the app root:

```bash
python examples/dogfood_agent.py
```

Then open `/runtime/dogfood-procurement-agent`.

## Export JSON Schema

```bash
python scripts/export_json_schema.py
```
