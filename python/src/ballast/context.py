"""Invocation context + config for the Ballast SDK."""

from __future__ import annotations

import contextvars
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ballast.schema import (
    DelegationObservation,
    GuardrailObservation,
    InstructionsObservation,
    KnowledgeObservation,
    MemoryObservation,
    ObservationStatus,
    ToolObservation,
    ToolsObservation,
)


@dataclass
class SdkConfig:
    collector_url: str = "http://localhost:3000/api/v1/snapshots"
    agent_id: str = "default-agent"
    buffer_path: Optional[str] = None
    timeout_seconds: float = 2.0


@dataclass
class InvocationState:
    agent_id: str
    session_id: Optional[str] = None
    instructions: Optional[InstructionsObservation] = None
    tools: Optional[ToolsObservation] = None
    knowledge: Optional[KnowledgeObservation] = None
    memory: Optional[MemoryObservation] = None
    guardrails: Optional[GuardrailObservation] = None
    delegation: Optional[DelegationObservation] = None
    _guardrail_names: List[str] = field(default_factory=list)
    _guardrail_blocked: bool = False

    def set_instructions(
        self,
        *,
        resolved_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        prompt_source: Optional[str] = None,
    ) -> None:
        self.instructions = InstructionsObservation(
            status=ObservationStatus.OBSERVED,
            resolved_prompt=resolved_prompt,
            model=model,
            temperature=temperature,
            prompt_source=prompt_source,
        )

    def set_tools(self, *, bound: List[Dict[str, Any]]) -> None:
        tools = []
        for item in bound:
            tools.append(
                ToolObservation(
                    name=str(item["name"]),
                    type=item.get("type"),
                    definition_hash=item.get("definition_hash"),
                    invoked=bool(item.get("invoked", False)),
                )
            )
        self.tools = ToolsObservation(
            status=ObservationStatus.OBSERVED,
            bound_tools=tools,
        )

    def set_knowledge(
        self,
        *,
        sources_hit: Optional[List[str]] = None,
        retrieval_config: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.knowledge = KnowledgeObservation(
            status=ObservationStatus.OBSERVED,
            sources_hit=list(sources_hit or []),
            retrieval_config=dict(retrieval_config or {}),
        )

    def set_memory(
        self,
        *,
        store: Optional[str] = None,
        keys_read: Optional[List[str]] = None,
        keys_written: Optional[List[str]] = None,
    ) -> None:
        self.memory = MemoryObservation(
            status=ObservationStatus.OBSERVED,
            store=store,
            keys_read=list(keys_read or []),
            keys_written=list(keys_written or []),
        )

    def add_guardrail(self, *, name: str, invoked: bool = True, blocked: bool = False) -> None:
        if invoked and name not in self._guardrail_names:
            self._guardrail_names.append(name)
        if blocked:
            self._guardrail_blocked = True
        self.guardrails = GuardrailObservation(
            status=ObservationStatus.OBSERVED,
            guardrails_invoked=list(self._guardrail_names),
            blocked=self._guardrail_blocked,
        )

    def set_delegation(
        self,
        *,
        agent_name: Optional[str] = None,
        agent_version: Optional[str] = None,
        delegated_to: Optional[List[str]] = None,
    ) -> None:
        self.delegation = DelegationObservation(
            status=ObservationStatus.OBSERVED,
            agent_name=agent_name,
            agent_version=agent_version,
            delegated_to=list(delegated_to or []),
        )


_config: SdkConfig = SdkConfig()
_invocation: contextvars.ContextVar[Optional[InvocationState]] = contextvars.ContextVar(
    "ballast_invocation", default=None
)


def get_config() -> SdkConfig:
    return _config


def set_config(config: SdkConfig) -> None:
    global _config
    _config = config


def get_invocation() -> Optional[InvocationState]:
    return _invocation.get()


def set_invocation(state: Optional[InvocationState]) -> contextvars.Token:
    return _invocation.set(state)


def reset_invocation(token: contextvars.Token) -> None:
    _invocation.reset(token)
