import json
from pathlib import Path

from ballast.schema import HarnessSnapshot, ObservationStatus

FIXTURES = Path(__file__).resolve().parents[2] / "schemas" / "fixtures"


def test_pydantic_accepts_observed_fixture():
    raw = json.loads((FIXTURES / "snapshot.observed.json").read_text())
    snap = HarnessSnapshot.model_validate(raw)
    assert snap.source.value == "sdk"
    cov = snap.coverage()
    assert all(s is ObservationStatus.OBSERVED for s in cov.values())
    invoked = [t for t in snap.tools.bound_tools if t.invoked]
    bound_only = [t for t in snap.tools.bound_tools if not t.invoked]
    assert len(invoked) >= 1
    assert len(bound_only) >= 1


def test_pydantic_accepts_partial_fixture():
    raw = json.loads((FIXTURES / "snapshot.partial.json").read_text())
    snap = HarnessSnapshot.model_validate(raw)
    cov = snap.coverage()
    assert cov["instructions"] is ObservationStatus.OBSERVED
    for key in ("tools", "knowledge", "memory", "guardrails", "delegation"):
        assert cov[key] is ObservationStatus.NOT_OBSERVED
        assert cov[key].value == "not_observed"
