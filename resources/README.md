# brickseasy extracted data

This folder contains reusable JSON exports of the data embedded in the application. It is intentionally separate from `src/` so another application, service, or pricing pipeline can consume the catalog without importing React code.

## Files

- `catalog.json` — clouds, regions, multipliers, warehouse sizes, VM profiles, regional VM prices, regional DBU prices, workload catalog, compute-family guidance, instance mappings, and infrastructure assumptions.
- `pricing-sources.json` — vendor pricing-reference URLs shown in the app.
- `compute-guide.json` — SQL warehouse comparison and Lakeflow Spark Declarative Pipelines feature matrix.
- `app-defaults.json` — estimator defaults, schedule presets, supported currencies/periods, input limits, runtime rules, and share-link codes.
- `index.json` — export manifest and provenance.

## Pricing semantics

- `catalog.json.dbuPricing` is a flat, directly consumable table. Each row is keyed by `cloud`, `regionId`, `workloadType`, and `computeId`.
- `ratePerDbu` is a USD per DBU-hour list rate.
- `vmHourlyRates` contains one-VM USD/hour rates. Azure rows retain both the provider-facing `instanceId` and the compact Vantage `sku`.
- `includesCloudInstance: true` means the underlying cloud VM cost is included in the DBU rate and should not be added a second time.
- Azure managed disks are documented in `infrastructureAssumptions` but are not priced or included in estimates.
- The repository describes the prices as illustrative, time-sensitive planning figures. Taxes, data transfer, and reserved-pricing discounts are excluded.

## Provenance

The values were extracted from the current repository on 2026-08-30. The VM-rate source comment in the application says those rates were refreshed on 2026-07-21. Update the JSON and the application source together if the catalog changes.
