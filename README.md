# StrategyShifu

**Decide with your agent.**

StrategyShifu helps people decide with their agents. It is a shared decision workspace for Databricks cost planning and Migration-to-Databricks migration planning, where agents can inspect context, update inputs, compare options, and explain recommendations while people guide the conversation and make the call. Browser-native WebMCP tools connect agents to the same live state, while deterministic scoring, regional pricing, and migration risk signals keep each decision transparent and auditable.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production check, use `npm run typecheck` and `npm run build`.

## Decision tools

- **Databricks Cost** (`/`) — model named DWH, ETL, and development workloads; configure category-specific compute, sizing, schedules, regions, budgets, currency, networking, and Genie requirements; then compare eligible options against the complete project budget.
- **Migration to Databricks** (`/migrate/redshift-to-databricks`) — assess Redshift migration strategies across data movement, workload shape, coexistence, downtime, target format, synchronization, special data types, and execution readiness.
- **Compute Guide** (`/compute-guide`) — compare Databricks SQL warehouse capabilities across Serverless, Pro, and Classic.

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
- Workload-level chat/NLP intent that highlights Databricks Genie and limits DWH recommendations to Serverless or Pro
- Migration scoring for Iceberg coexistence, Lakehouse Federation, UNLOAD to S3, and JDBC copy alternatives
- Migration execution signals for phased vs. big-bang delivery, ETL/BI/POC sequencing, change synchronization, datatype risk, and cutover gates
- Seventeen cost-planning WebMCP tools and seven migration WebMCP tools registered on `document.modelContext`
- Best-effort live capability checks for Redshift and Databricks, with a structured fallback when documentation is unavailable
- Share, Copy, CSV, and Print / PDF exports on the cost and migration assessment views
- A shared React state model used by both human controls and agent calls

Pricing is loaded from [`resources/catalog.json`](./resources/catalog.json). These are time-sensitive planning rates, not a Databricks quote; taxes, Azure managed disks, data transfer, and reserved-pricing discounts are excluded.

## Cost recommendation logic

The decision engine applies this order:

1. Price every configured workload using its selected compute and independent schedule.
2. For the active workload, resolve all category-valid compute alternatives.
3. Add the unchanged cost of every other workload to each candidate project.
4. Apply private-networking and Databricks Genie compatibility gates.
5. Apply the project-budget gate.
6. Rank eligible options by cost efficiency and operational simplicity.
7. Recommend only an option that passes every gate.

If no technically valid strategy is within budget, StrategyShifu returns no recommendation. See [`docs/architecture.md`](./docs/architecture.md) for the full model.

## Migration recommendation logic

The migration advisor evaluates four practical paths:

1. Iceberg coexistence for an interoperable S3 layer during a phased transition.
2. Lakehouse Federation for read-only access and incremental migration use cases.
3. Redshift `UNLOAD` to S3/Parquet for scalable bulk movement.
4. JDBC copy for smaller, controlled transfers where bulk export is not the best fit.

The score is adjusted for data volume, largest-table size, change rate, write pattern, SQL complexity, coexistence window, downtime tolerance, shared S3, target state and format, migration priority, change-synchronization plan, and special or incompatible data types. Every assessment also returns an execution approach, recommended sequencing, readiness risk, assumptions, and checks that should be closed before production cutover.

The migration page can refresh structured capability evidence from the server-side API. If a source is unavailable, the advisor returns the last-known structured fallback and marks it as not fresh; it does not block the deterministic assessment.

## Exporting an assessment

The shared export toolbar is available on both decision tools:

- **Share** copies a shareable title and URL when native sharing is unavailable.
- **Copy** copies a readable summary of the current recommendation and inputs.
- **CSV** downloads the current workload, strategy, and cost/migration assessment data.
- **Print / PDF** opens the browser print dialog; choose **Save as PDF** for a formatted report. Migration print output includes the assessment context and cutover guidance while hiding interactive controls.

## Why WebMCP fits

StrategyShifu is designed for decisions that benefit from both structured automation and human judgment. WebMCP gives an agent a browser-native way to inspect the project, test alternatives, and make controlled updates, while the same shared state keeps the visible UI, cost model, compatibility gates, and recommendation synchronized. That makes the agent useful for exploring configuration without turning the decision into a black box—and keeps every result available for the person using the app to review.

## What people and agents can do together

People can describe a goal in the UI or chat, adjust requirements, workloads, schedules, regions, and budgets, and see the comparison update immediately. Agents can read the current state, add or edit workloads, ask for valid pricing options, compare strategies, estimate project costs, and retrieve the recommendation. Together they can iterate on “what if” scenarios: the agent handles repeatable configuration and analysis, while the person supplies context, challenges assumptions, and makes the final decision.

## WebMCP tools

The Databricks Cost page registers the following browser-native tools:

| Tool | Purpose |
| --- | --- |
| `get_decision_state` | Read the complete input state and computed comparison |
| `list_workloads` | List the project workloads and active workload |
| `add_workload` | Add a named DWH, ETL, or DEV workload |
| `update_workload` | Update compute, sizing, or the chat/NLP requirement |
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

The Migration to Databricks page registers seven additional tools: four capability readers, `get_migration_assessment`, `update_migration_inputs`, and `assess_redshift_databricks_migration`. Migration capability readers return structured evidence for Redshift Iceberg, Databricks Iceberg, Redshift federation, and Redshift export options.

## Project structure

```text
app/                    Next.js App Router shell and global visual system
app/api/migration-capabilities/  Server-side capability retrieval and fallback API
app/compute-guide/      Read-only Databricks SQL warehouse capability guide
app/migrate/            Redshift-to-Databricks migration advisor route
components/             Decision workspace and icon components
components/export-toolbar.tsx  Shared Share, Copy, CSV, and Print / PDF actions
components/migration-advisor.tsx  Migration inputs, scoring results, risks, and cutover guidance
hooks/use-webmcp.ts     WebMCP registration bound to shared UI state
hooks/use-migration-webmcp.ts  Migration WebMCP registration and capability tools
lib/decision-engine.ts  Deterministic evaluation and scoring
lib/migration-engine.ts  Migration strategy scoring and readiness evaluation
lib/migration-types.ts  Migration input, score, recommendation, and evidence types
lib/pricing.ts          Regional DWH, DBU, driver, and worker cost model
lib/workloads.ts        Workload defaults, validation, and cloud normalization
lib/strategies.ts       DWH, ETL, and DEV compute definitions
lib/presets.ts          Demo scenarios
resources/              Reusable pricing and sizing catalogs
types/webmcp.d.ts       Minimal draft WebMCP browser typings
docs/                   Architecture and WebMCP details
```
