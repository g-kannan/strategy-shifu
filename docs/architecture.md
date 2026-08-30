# Architecture overview

StrategyShifu is a client-side Next.js application with three deliberately separate layers.

## Shared decision state

`DecisionState` contains the workload, hard requirements, budget, and editable assumptions. The React workspace owns this state. Human controls mutate it directly; WebMCP tools receive the latest state through a ref and call the same state setter. There is no second agent-only store.

## Strategy configuration

`lib/strategies.ts` contains structured strategy definitions: capability flags, SLA threshold, pricing coefficients, operational score, advantages, and disadvantages. These are labeled reference assumptions rather than live Databricks prices. Replacing this file with periodically refreshed configuration or an API adapter does not require changes to the evaluator.

## Deterministic evaluator

`lib/decision-engine.ts` is a pure calculation layer. It:

1. evaluates workload, networking, and SLA constraints;
2. calculates a rounded monthly estimate;
3. evaluates budget compatibility;
4. assigns an inspectable score; and
5. selects only from strategies that pass both hard gates.

The score contributes ranking within the eligible set; it can never override a technical failure or budget failure.

The reference estimate is:

```text
base monthly cost
+ monthly runtime hours × compute rate × worker scale × workload factor
+ monthly data volume × volume rate × worker scale
```

Streaming uses a workload factor of `1.0`; bounded batch work uses `0.74`. Results are rounded to whole dollars to avoid false precision.

## UI and browser-agent boundary

`components/decision-workspace.tsx` renders the single-page human workspace. `hooks/use-webmcp.ts` registers eight high-level operations with `document.modelContext`. Tool callbacks return both MCP-style text content and structured content. Each mutation returns the updated comparison, allowing an agent to act and reason without scraping rendered cards.

If WebMCP is unavailable, all human controls continue to work and the header shows `UI ready` rather than claiming an agent connection.
