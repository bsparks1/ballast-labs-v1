import json
from pathlib import Path

import ballast
from ballast.schema import ObservationStatus


def test_track_emits_partial_on_exception(tmp_path: Path):
    buffer = tmp_path / "buf.jsonl"
    ballast.init(
        collector_url="http://127.0.0.1:9/api/v1/snapshots",
        agent_id="test-agent",
        buffer_path=str(buffer),
        timeout_seconds=0.2,
    )

    @ballast.track(agent_id="test-agent")
    def boom():
        ballast.instructions(resolved_prompt="hi", model="m", prompt_source="inline")
        raise RuntimeError("agent failed")

    try:
        boom()
    except RuntimeError:
        pass

    lines = buffer.read_text().strip().splitlines()
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["instructions"]["status"] == ObservationStatus.OBSERVED.value
    assert payload["tools"]["status"] == ObservationStatus.NOT_OBSERVED.value
    assert payload["source"] == "sdk"


def test_bound_not_invoked_tool(tmp_path: Path):
    buffer = tmp_path / "buf.jsonl"
    ballast.init(
        collector_url="http://127.0.0.1:9/api/v1/snapshots",
        agent_id="test-agent",
        buffer_path=str(buffer),
        timeout_seconds=0.2,
    )

    @ballast.track()
    def run():
        ballast.tools(
            bound=[
                {"name": "search_vendors", "type": "function", "invoked": True},
                {"name": "create_po", "type": "function", "invoked": False},
            ]
        )

    run()
    payload = json.loads(buffer.read_text().strip())
    tools = payload["tools"]["bound_tools"]
    assert tools[0]["invoked"] is True
    assert tools[1]["invoked"] is False
