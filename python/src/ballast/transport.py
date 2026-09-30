"""Offline-safe transport: POST to collector or buffer to JSONL."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import httpx

from ballast.context import SdkConfig
from ballast.schema import HarnessSnapshot


def default_buffer_path() -> Path:
    return Path.home() / ".ballast" / "buffer.jsonl"


def emit_snapshot(snapshot: HarnessSnapshot, config: SdkConfig) -> None:
    """Best-effort emit. Never raises into the host agent."""
    try:
        payload = snapshot.model_dump(mode="json")
        try:
            with httpx.Client(timeout=config.timeout_seconds) as client:
                response = client.post(config.collector_url, json=payload)
                if 200 <= response.status_code < 300:
                    return
        except Exception:
            pass
        _buffer(payload, config)
    except Exception:
        # Absolute last resort — never crash the observed agent.
        pass


def _buffer(payload: Dict[str, Any], config: SdkConfig) -> None:
    path = Path(config.buffer_path) if config.buffer_path else default_buffer_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, default=str) + "\n")
