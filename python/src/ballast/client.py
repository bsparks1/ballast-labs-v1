"""Public SDK surface: init, @track, and component recorders."""

from __future__ import annotations

import functools
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, TypeVar

from ballast.context import (
    InvocationState,
    SdkConfig,
    get_config,
    get_invocation,
    reset_invocation,
    set_config,
    set_invocation,
)
from ballast.schema import (
    DelegationObservation,
    GuardrailObservation,
    HarnessSnapshot,
    IngestionSource,
    InstructionsObservation,
    KnowledgeObservation,
    MemoryObservation,
    ObservationStatus,
    ToolsObservation,
)
from ballast.transport import emit_snapshot

F = TypeVar("F", bound=Callable[..., Any])


def init(
    *,
    collector_url: str = "http://localhost:3000/api/v1/snapshots",
    agent_id: str = "default-agent",
    buffer_path: Optional[str] = None,
    timeout_seconds: float = 2.0,
) -> None:
    set_config(
        SdkConfig(
            collector_url=collector_url,
            agent_id=agent_id,
            buffer_path=buffer_path,
            timeout_seconds=timeout_seconds,
        )
    )


def track(
    agent_id: Optional[str] = None, session_id: Optional[str] = None
) -> Callable[[F], F]:
    """Open an invocation context; emit HarnessSnapshot on exit (success or failure)."""

    def decorator(fn: F) -> F:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            config = get_config()
            resolved_agent = agent_id or config.agent_id
            state = InvocationState(agent_id=resolved_agent, session_id=session_id)
            token = set_invocation(state)
            try:
                return fn(*args, **kwargs)
            finally:
                try:
                    snapshot = _assemble(state)
                    emit_snapshot(snapshot, config)
                except Exception:
                    pass
                reset_invocation(token)

        return wrapper  # type: ignore[return-value]

    return decorator


def _assemble(state: InvocationState) -> HarnessSnapshot:
    return HarnessSnapshot(
        snapshot_id=str(uuid.uuid4()),
        agent_id=state.agent_id,
        session_id=state.session_id,
        captured_at=datetime.now(timezone.utc),
        source=IngestionSource.SDK,
        instructions=state.instructions
        or InstructionsObservation(status=ObservationStatus.NOT_OBSERVED),
        tools=state.tools or ToolsObservation(status=ObservationStatus.NOT_OBSERVED),
        knowledge=state.knowledge
        or KnowledgeObservation(status=ObservationStatus.NOT_OBSERVED),
        memory=state.memory or MemoryObservation(status=ObservationStatus.NOT_OBSERVED),
        guardrails=state.guardrails
        or GuardrailObservation(status=ObservationStatus.NOT_OBSERVED),
        delegation=state.delegation
        or DelegationObservation(status=ObservationStatus.NOT_OBSERVED),
    )


def _require_invocation() -> InvocationState:
    state = get_invocation()
    if state is None:
        raise RuntimeError("ballast recorders require an active @ballast.track context")
    return state


def instructions(
    *,
    resolved_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    prompt_source: Optional[str] = None,
) -> None:
    try:
        _require_invocation().set_instructions(
            resolved_prompt=resolved_prompt,
            model=model,
            temperature=temperature,
            prompt_source=prompt_source,
        )
    except Exception:
        pass


def tools(*, bound: List[Dict[str, Any]]) -> None:
    try:
        _require_invocation().set_tools(bound=bound)
    except Exception:
        pass


def knowledge(
    *,
    sources_hit: Optional[List[str]] = None,
    retrieval_config: Optional[Dict[str, Any]] = None,
) -> None:
    try:
        _require_invocation().set_knowledge(
            sources_hit=sources_hit,
            retrieval_config=retrieval_config,
        )
    except Exception:
        pass


def memory(
    *,
    store: Optional[str] = None,
    keys_read: Optional[List[str]] = None,
    keys_written: Optional[List[str]] = None,
) -> None:
    try:
        _require_invocation().set_memory(
            store=store,
            keys_read=keys_read,
            keys_written=keys_written,
        )
    except Exception:
        pass


def guardrail(*, name: str, invoked: bool = True, blocked: bool = False) -> None:
    try:
        _require_invocation().add_guardrail(name=name, invoked=invoked, blocked=blocked)
    except Exception:
        pass


def delegation(
    *,
    agent_name: Optional[str] = None,
    agent_version: Optional[str] = None,
    delegated_to: Optional[List[str]] = None,
) -> None:
    try:
        _require_invocation().set_delegation(
            agent_name=agent_name,
            agent_version=agent_version,
            delegated_to=delegated_to,
        )
    except Exception:
        pass
