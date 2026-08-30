# Architecture overview

StrategyShifu is a client-side Next.js application with shared project state, catalog-backed pricing, deterministic comparison, and a browser-agent boundary.

## Shared project state

DecisionState contains a project name, display cost period, a collection of named workloads, the active workload ID, global cloud and region, private-networking requirement, currency, and project budget. Each workload owns its category, selected compute, category-specific sizing, and schedule.

The React workspace owns this state. Human controls and WebMCP mutations call the same state setter; there is no agent-only store.

## Workload semantics

Workload category answers **what is running**:

- DWH — interactive SQL and BI dashboards
- ETL — scheduled ingestion and transformations
- DEV — interactive notebooks and development

Schedule answers **when it runs**. It affects monthly runtime cost but never changes workload category.

Category controls the visible sizing model:

- DWH uses a SQL warehouse size.
- ETL Serverless uses emitted DBU/hour and pipeline count.
- ETL Classic uses driver instance, worker instance, worker count, and pipeline count.
- DEV uses driver instance, worker instance, and worker count.

## Pricing

resources/catalog.json contains warehouse sizes, instance profiles, regional DBU list rates, and regional VM rates. lib/pricing.ts is the typed calculation layer.

The common estimate is:

~~~text
monthly DBU cost = DBU/hour × regional DBU rate × runtime hours × scale
monthly infrastructure = (driver VM/hour + workers × worker VM/hour) × runtime hours × scale
monthly workload total = DBU cost + infrastructure
~~~

Scale is the pipeline count for ETL. Serverless compute omits infrastructure because its catalog DBU rate includes it. DWH Pro and Classic add one driver plus the selected warehouse size's worker VMs. A 24 × 31 schedule is normalized to 730 hours.

## Project comparison

lib/decision-engine.ts compares compute alternatives only for the active workload. The configured costs of every other workload remain fixed and are added to each candidate, so budget fit always refers to the complete project.

The engine:

1. prices every configured workload;
2. resolves category-valid strategies for the active workload;
3. checks private networking;
4. checks total project budget;
5. ranks eligible options by cost efficiency and operational simplicity; and
6. selects only from options passing both hard gates.

## UI and browser-agent boundary

components/decision-workspace.tsx renders the project summary, workload collection, category-specific editor, desktop comparison matrix, recommendation explanation, mobile card fallback, and independent schedule controls. Strategy metadata supplies qualitative performance, operating-effort, best-fit, and trade-off rows without weakening the evaluator's hard gates. hooks/use-webmcp.ts registers seventeen project operations through document.modelContext.

Tool callbacks return text plus structured content. Every mutating tool returns updated state or comparison data, allowing agents to continue without scraping cards while keeping changes visible to the user.
