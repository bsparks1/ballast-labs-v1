"""Canonical HarnessSnapshot schema — the asset both SDK and OTel populate."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ObservationStatus(str, Enum):
    OBSERVED = "observed"
    NOT_OBSERVED = "not_observed"
    ABSENT = "absent"


class IngestionSource(str, Enum):
    STATIC_REPO = "static_repo"
    SDK = "sdk"
    OTEL = "otel"


class InstructionsObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ObservationStatus
    resolved_prompt: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    prompt_source: Optional[str] = None


class ToolObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    type: Optional[str] = None
    definition_hash: Optional[str] = None
    invoked: bool = False


class ToolsObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ObservationStatus
    bound_tools: List[ToolObservation] = Field(default_factory=list)


class KnowledgeObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ObservationStatus
    sources_hit: List[str] = Field(default_factory=list)
    retrieval_config: Dict[str, Any] = Field(default_factory=dict)


class MemoryObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ObservationStatus
    store: Optional[str] = None
    keys_read: List[str] = Field(default_factory=list)
    keys_written: List[str] = Field(default_factory=list)


class GuardrailObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ObservationStatus
    guardrails_invoked: List[str] = Field(default_factory=list)
    blocked: bool = False


class DelegationObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ObservationStatus
    agent_name: Optional[str] = None
    agent_version: Optional[str] = None
    delegated_to: List[str] = Field(default_factory=list)


class HarnessSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    snapshot_id: str
    agent_id: str
    session_id: Optional[str] = None
    captured_at: datetime
    source: IngestionSource

    instructions: InstructionsObservation
    tools: ToolsObservation
    knowledge: KnowledgeObservation
    memory: MemoryObservation
    guardrails: GuardrailObservation
    delegation: DelegationObservation

    def coverage(self) -> Dict[str, ObservationStatus]:
        """Per-component observation status — drives the not-observed UX."""
        return {
            c: getattr(self, c).status
            for c in (
                "instructions",
                "tools",
                "knowledge",
                "memory",
                "guardrails",
                "delegation",
            )
        }


def not_observed_component(kind: str) -> BaseModel:
    """Factory for an empty NOT_OBSERVED observation of the given component."""
    factories = {
        "instructions": InstructionsObservation,
        "tools": ToolsObservation,
        "knowledge": KnowledgeObservation,
        "memory": MemoryObservation,
        "guardrails": GuardrailObservation,
        "delegation": DelegationObservation,
    }
    cls = factories[kind]
    return cls(status=ObservationStatus.NOT_OBSERVED)
