from datetime import datetime, timezone

from ballast.schema import (
    DelegationObservation,
    GuardrailObservation,
    HarnessSnapshot,
    IngestionSource,
    InstructionsObservation,
    KnowledgeObservation,
    MemoryObservation,
    ObservationStatus,
    ToolObservation,
    ToolsObservation,
)


def test_not_observed_never_coerces_to_clean():
    snap = HarnessSnapshot(
        snapshot_id="s1",
        agent_id="a1",
        captured_at=datetime.now(timezone.utc),
        source=IngestionSource.SDK,
        instructions=InstructionsObservation(status=ObservationStatus.NOT_OBSERVED),
        tools=ToolsObservation(status=ObservationStatus.NOT_OBSERVED),
        knowledge=KnowledgeObservation(status=ObservationStatus.NOT_OBSERVED),
        memory=MemoryObservation(status=ObservationStatus.NOT_OBSERVED),
        guardrails=GuardrailObservation(status=ObservationStatus.NOT_OBSERVED),
        delegation=DelegationObservation(status=ObservationStatus.NOT_OBSERVED),
    )
    cov = snap.coverage()
    assert set(cov.keys()) == {
        "instructions",
        "tools",
        "knowledge",
        "memory",
        "guardrails",
        "delegation",
    }
    for status in cov.values():
        assert status is ObservationStatus.NOT_OBSERVED
        assert status.value == "not_observed"
        assert status.value != "observed"
        assert status.value != "absent"


def test_absent_distinct_from_not_observed():
    g = GuardrailObservation(status=ObservationStatus.ABSENT, guardrails_invoked=[], blocked=False)
    assert g.status is ObservationStatus.ABSENT
    assert g.status is not ObservationStatus.NOT_OBSERVED


def test_tools_bound_vs_invoked():
    tools = ToolsObservation(
        status=ObservationStatus.OBSERVED,
        bound_tools=[
            ToolObservation(name="search_vendors", type="function", invoked=True),
            ToolObservation(name="create_po", type="function", invoked=False),
        ],
    )
    assert tools.bound_tools[0].invoked is True
    assert tools.bound_tools[1].invoked is False
    assert tools.status is ObservationStatus.OBSERVED
