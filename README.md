# StrategyShifu

**Decide with your agent.**

StrategyShifu is an agent-ready technical decision engine for a project made up of Databricks workloads. Users can add named DWH, ETL, and development workloads, configure category-specific compute and sizing, schedule each workload independently, and compare alternatives against one regional project budget.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production check, use `npm run typecheck` and `npm run build`.

## What is included

- Single-DWH and mixed DWH/ETL example projects
- Deterministic compatibility, cost, budget, and ranking logic
- Named workload collection with add, edit, select, and remove actions
- DWH, ETL, and development compute options with category-specific sizing
- Independent schedule per workload
- Regional DBU and VM rates for AWS, Azure, and GCP
- Transparent DBU and infrastructure cost components on every strategy
- Desktop comparison matrix, recommendation explanation, and mobile card fallback
- Separate Compute Guide page with Databricks SQL warehouse capability comparison
- Explicit hard-gate Pass/Fail states plus structured performance and operations guidance
- Seventeen high-level WebMCP tools registered on `document.modelContext`
- A shared React state model used by both human controls and agent calls

Pricing is loaded from [`resources/catalog.json`](./resources/catalog.json). These are time-sensitive planning rates, not a Databricks quote; taxes, Azure managed disks, data transfer, and reserved-pricing discounts are excluded.

## Recommendation logic

The decision engine applies this order:

1. Price every configured workload using its selected compute and independent schedule.
2. For the active workload, resolve all category-valid compute alternatives.
3. Add the unchanged cost of every other workload to each candidate project.
4. Apply private-networking and project-budget gates.
5. Rank eligible options by cost efficiency and operational simplicity.
6. Recommend only an option that passes both gates.

If no technically valid strategy is within budget, StrategyShifu returns no recommendation. See [`docs/architecture.md`](./docs/architecture.md) for the full model.

## WebMCP tools

The page registers the following browser-native tools:

| Tool | Purpose |
| --- | --- |
| `get_decision_state` | Read the complete input state and computed comparison |
| `list_workloads` | List the project workloads and active workload |
| `add_workload` | Add a named DWH, ETL, or DEV workload |
| `update_workload` | Update compute or category-specific sizing |
| `remove_workload` | Remove a workload except the final one |
| `select_workload` | Focus the UI and comparison on one workload |
| `set_requirement` | Update cloud or private-networking requirements |
| `set_region` | Update the provider-native pricing region |
| `set_budget` | Update the monthly project budget |
| `update_project` | Update the project name or monthly/annual display period |
| `set_currency` | Toggle USD/INR display and update the conversion rate |
| `set_workload_schedule` | Set one workload's runtime independently |
| `set_dwh_sizing` | Choose a DWH warehouse size |
| `get_pricing_options` | Inspect category-valid regional pricing options |
| `compare_strategies` | Compare options for the active workload |
| `get_cost_estimates` | Return configured workload and project totals |
| `get_recommendation` | Return the best active-workload option |

The implementation uses the current imperative WebMCP surface, `document.modelContext.registerTool()`, and unregisters tools with an `AbortSignal`. See [`docs/webmcp.md`](./docs/webmcp.md) for schemas and behavior.

## Project structure

```text
app/                    Next.js App Router shell and global visual system
app/compute-guide/      Read-only Databricks SQL warehouse capability guide
components/             Decision workspace and icon components
hooks/use-webmcp.ts     WebMCP registration bound to shared UI state
lib/decision-engine.ts  Deterministic evaluation and scoring
lib/pricing.ts          Regional DWH, DBU, driver, and worker cost model
lib/workloads.ts        Workload defaults, validation, and cloud normalization
lib/strategies.ts       DWH, ETL, and DEV compute definitions
lib/presets.ts          Demo scenarios
resources/              Reusable pricing and sizing catalogs
types/webmcp.d.ts       Minimal draft WebMCP browser typings
docs/                   Architecture and WebMCP details
```

## Scope

The MVP intentionally has no authentication, backend, LLM calculation, database, billing, export, or live cloud-pricing integration. The architecture keeps catalog data and deterministic evaluation logic separate so live pricing can be added later without changing the human/agent interaction model.
