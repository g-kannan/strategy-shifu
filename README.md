# StrategyShifu

**Decide with your agent.**

StrategyShifu is an agent-ready technical decision engine. The MVP compares three Databricks data-engineering strategies against a shared workload, hard technical requirements, runtime assumptions, and a monthly budget. It does not simply pick the cheapest option: a strategy must pass technical constraints before it can be recommended.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production check, use `npm run typecheck` and `npm run build`.

## What is included

- Streaming and batch example scenarios
- Deterministic compatibility, cost, budget, and ranking logic
- Three locally configured Databricks strategies
- Editable workload, networking, SLA, cloud, region, runtime, and budget inputs
- Cloud-aware demo regions limited to one US East and one India option per provider
- A comparison-first responsive interface with explicit pass/fail states
- Eight high-level WebMCP tools registered on `document.modelContext`
- A shared React state model used by both human controls and agent calls

Pricing is reference/demo pricing only and is intentionally isolated in [`lib/strategies.ts`](./lib/strategies.ts).

## Recommendation logic

The decision engine applies this order:

1. Check hard technical constraints: workload support, private networking, and SLA.
2. Estimate monthly cost from base cost, runtime, worker scale, and monthly data volume.
3. Check the estimate against the monthly budget.
4. Rank eligible options by workload suitability, cost efficiency, and operational simplicity.
5. Recommend the highest-ranked strategy that passes both technical and budget checks.

If no technically valid strategy is within budget, StrategyShifu returns no recommendation. See [`docs/architecture.md`](./docs/architecture.md) for the full model.

## WebMCP tools

The page registers the following browser-native tools:

| Tool | Purpose |
| --- | --- |
| `get_decision_state` | Read the complete input state and computed comparison |
| `set_workload` | Update workload type, description, volume, or SLA |
| `set_requirement` | Update cloud or private-networking requirements |
| `set_budget` | Update the monthly USD budget and recompute |
| `set_assumption` | Update runtime, region, or worker scale |
| `compare_strategies` | Run the deterministic comparison |
| `get_cost_estimates` | Return every estimate and the assumptions used |
| `get_recommendation` | Return the best eligible strategy or no-match result |

The implementation uses the current imperative WebMCP surface, `document.modelContext.registerTool()`, and unregisters tools with an `AbortSignal`. See [`docs/webmcp.md`](./docs/webmcp.md) for schemas and behavior.

### WebMCP Challenge Demo

This flow is designed to fit comfortably inside three minutes:

1. Open StrategyShifu. The streaming/private-network example is loaded with a $1,000 budget.
2. Point out that Serverless is cheaper but fails the private-networking requirement, while Classic is technically valid but over budget. There is correctly no recommendation.
3. Ask the browser agent:

   > Open StrategyShifu. Load the streaming architecture example. My monthly budget is $1,500 and I require private networking. Compare the available strategies and recommend the best option.

4. The agent calls `set_budget` and, if needed, `set_requirement`. The human UI visibly updates and recommends Classic.
5. Ask:

   > Change my budget to $1,100 and reconsider the decision.

6. The recommendation returns to no-match because the valid option is over budget.
7. Ask:

   > Change the runtime from 24 hours per day to 8 hours and recalculate the recommendation.

8. The reduced runtime changes every estimate using the same state and Classic becomes eligible again.
9. Finish by changing a slider manually and asking the agent for `get_recommendation`, demonstrating human/agent collaboration over one decision.

## Project structure

```text
app/                    Next.js App Router shell and global visual system
components/             Decision workspace and icon components
hooks/use-webmcp.ts     WebMCP registration bound to shared UI state
lib/decision-engine.ts  Deterministic evaluation and scoring
lib/strategies.ts       Strategy definitions and reference pricing
lib/presets.ts          Demo scenarios
types/webmcp.d.ts       Minimal draft WebMCP browser typings
docs/                   Architecture and WebMCP details
```

## Scope

The MVP intentionally has no authentication, backend, LLM calculation, database, billing, export, or live cloud-pricing integration. The architecture keeps strategy data and evaluation logic separate so those can be added later without changing the human/agent interaction model.
