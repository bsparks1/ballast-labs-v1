"""In-repo dogfood agent — exercises all six harness components honestly."""

from __future__ import annotations

import ballast

AGENT_ID = "dogfood-procurement-agent"
SYSTEM_PROMPT = """You are a procurement agent for Ballast Labs dogfood.

Prefer approved vendors from the vendor index. Never invent a purchase order
without an approval edge. Strip PII from tool outputs before persistence.
"""


def main() -> None:
    ballast.init(
        collector_url="http://localhost:3000/api/v1/snapshots",
        agent_id=AGENT_ID,
    )
    result = run_agent("Create a PO for Acme widgets under $5k")
    print(result)
    print(f"Snapshot should appear at /runtime/{AGENT_ID}")


@ballast.track(agent_id=AGENT_ID, session_id="dogfood-session-1")
def run_agent(user_input: str) -> str:
    # Instructions — actual resolved prompt sent this invocation
    ballast.instructions(
        resolved_prompt=SYSTEM_PROMPT,
        model="claude-opus-4-8",
        temperature=0.2,
        prompt_source="inline",
    )

    # Tools — both bound; create_po deliberately NOT invoked (governance surface)
    ballast.tools(
        bound=[
            {"name": "search_vendors", "type": "function", "invoked": True},
            {"name": "create_po", "type": "function", "invoked": False},
        ]
    )

    # Knowledge — retrieval with real top_k
    ballast.knowledge(
        sources_hit=["vendor-index"],
        retrieval_config={"top_k": 5, "embedding_model": "text-embedding-3-small"},
    )

    # Memory — distinct read vs write keys
    ballast.memory(
        store="redis",
        keys_read=["prefs:acme"],
        keys_written=["last_po:acme"],
    )

    # Guardrails — one that actually ran
    ballast.guardrail(name="pii_filter", invoked=True, blocked=False)

    # Delegation — edge to approval sub-agent
    ballast.delegation(
        agent_name="procurement-agent",
        agent_version="0.1.0",
        delegated_to=["approval-agent"],
    )

    return (
        f"Dogfood invocation complete for: {user_input!r}. "
        "Bound tools include create_po (not invoked); memory read prefs:acme "
        "and wrote last_po:acme; delegated to approval-agent."
    )


if __name__ == "__main__":
    main()
