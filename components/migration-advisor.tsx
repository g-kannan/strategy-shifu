"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getComparisonValue, evaluateMigration, MIGRATION_STRATEGIES, type ComparisonCriterion } from "@/lib/migration-engine";
import type { CapabilityEvidence, MigrationInputs, StrategyId } from "@/lib/migration-types";
import { useMigrationWebMCP } from "@/hooks/use-migration-webmcp";
import { ChevronDown, Refresh } from "./icons";
import { ExportToolbar } from "./export-toolbar";
import { createShareUrl, isMigrationInputs, readSharedState } from "@/lib/share-state";

const DEFAULT_INPUTS: MigrationInputs = {
  dataSizeGb: 12_000,
  tableCount: 340,
  largestTableGb: 650,
  dailyChangeRate: "1–5%",
  writePattern: "MERGE / upsert",
  redshiftSqlComplexity: "Medium",
  keepRedshiftActive: true,
  coexistenceDuration: "3–6 months",
  downtimeTolerance: "< 1 hour",
  sharedS3Available: "Yes",
  targetState: "Databricks becomes primary platform",
  targetFormat: "No preference",
  migrationPriority: "Data pipelines / ETL",
  changeSyncPlan: "Scheduled incremental loads",
  specialDataTypes: "Some",
};

const PRESETS: Array<{ name: string; note: string; inputs: MigrationInputs }> = [
  {
    name: "Quick POC", note: "120 GB · evaluate first",
    inputs: { ...DEFAULT_INPUTS, dataSizeGb: 120, tableCount: 24, largestTableGb: 18, dailyChangeRate: "< 1%", writePattern: "Mostly read-only", redshiftSqlComplexity: "Low", coexistenceDuration: "< 1 month", downtimeTolerance: "Near zero", sharedS3Available: "No", targetState: "Evaluate Databricks before migration", targetFormat: "No preference", migrationPriority: "Selected workload POC", changeSyncPlan: "Write freeze", specialDataTypes: "None known" },
  },
  {
    name: "Large warehouse", note: "48 TB · phased move",
    inputs: { ...DEFAULT_INPUTS, dataSizeGb: 48_000, tableCount: 720, largestTableGb: 2_400, dailyChangeRate: "5–20%", redshiftSqlComplexity: "High", coexistenceDuration: "1–3 months", downtimeTolerance: "< 1 day", targetFormat: "Delta Lake", changeSyncPlan: "CDC / replication tool", specialDataTypes: "Extensive" },
  },
  {
    name: "6-month coexistence", note: "10 TB · shared S3",
    inputs: { ...DEFAULT_INPUTS, dataSizeGb: 10_000, tableCount: 300, largestTableGb: 500, coexistenceDuration: "3–6 months", targetFormat: "Iceberg", changeSyncPlan: "CDC / replication tool" },
  },
  {
    name: "Retire Redshift", note: "8 TB · direct exit",
    inputs: { ...DEFAULT_INPUTS, dataSizeGb: 8_000, tableCount: 280, largestTableGb: 900, dailyChangeRate: "1–5%", writePattern: "Mostly append", keepRedshiftActive: false, coexistenceDuration: undefined, downtimeTolerance: "< 1 day", targetState: "Databricks becomes primary platform", targetFormat: "Delta Lake", changeSyncPlan: "Write freeze", specialDataTypes: "None known" },
  },
];

const CRITERIA: ComparisonCriterion[] = ["Data copy", "Large datasets", "Near-zero downtime", "Coexistence", "Long-term architecture", "Migration simplicity"];
const STRATEGY_ORDER: StrategyId[] = ["iceberg", "federation", "unload", "jdbc"];

type RawCapabilities = Record<string, Record<string, unknown>>;

export function MigrationAdvisor() {
  const [inputs, setInputs] = useState<MigrationInputs>(DEFAULT_INPUTS);
  const [dataUnit, setDataUnit] = useState<"GB" | "TB">("TB");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<CapabilityEvidence[]>([]);
  const [capabilityState, setCapabilityState] = useState<"checking" | "live" | "fallback" | "unavailable">("checking");
  const [refreshing, setRefreshing] = useState(false);
  const comparisonRef = useRef<HTMLElement>(null);
  const onInputsChange = useCallback((next: MigrationInputs) => setInputs(next), []);
  const { connection, tools } = useMigrationWebMCP(inputs, onInputsChange);

  useEffect(() => {
    const sharedInputs = readSharedState("migration", isMigrationInputs);
    if (!sharedInputs) return;
    setInputs(sharedInputs);
    setDataUnit(sharedInputs.dataSizeGb >= 1000 ? "TB" : "GB");
  }, []);

  const recommendation = useMemo(() => evaluateMigration(inputs), [inputs]);
  const alternative = recommendation.alternatives[0];

  const loadCapabilities = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const response = await fetch(`/api/migration-capabilities?kind=all${force ? "&refresh=1" : ""}`);
      if (!response.ok) throw new Error("Capability request failed");
      const raw = await response.json() as RawCapabilities;
      const normalized = normalizeCapabilities(raw);
      setCapabilities(normalized);
      setCapabilityState(normalized.every((item) => item.fresh) ? "live" : "fallback");
    } catch {
      setCapabilityState("unavailable");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadCapabilities(); }, [loadCapabilities]);

  const setInput = <K extends keyof MigrationInputs>(key: K, value: MigrationInputs[K]) =>
    setInputs((current) => ({ ...current, [key]: value }));

  const displayDataSize = dataUnit === "TB" ? inputs.dataSizeGb / 1000 : inputs.dataSizeGb;
  const capabilityMessage = capabilityState === "checking" ? "Checking official documentation…"
    : capabilityState === "live" ? "Live capability validation available"
    : capabilityState === "fallback" ? "Using last known capability information"
    : "Live compatibility validation unavailable. Scores use migration characteristics only.";

  return (
    <main className="migration-page">
      <header className="site-header migration-header">
        <a className="brand" href="/" aria-label="StrategyShifu home">
          <span className="brand-lockup">
            <span className="brand-wordmark"><span>Strategy</span><b>Shifu</b></span>
            <small>Decide with your agent.</small>
          </span>
        </a>
        <nav className="page-nav" aria-label="Primary navigation">
          <a href="/">Databricks Cost</a>
          <a className="active" href="/migrate/redshift-to-databricks" aria-current="page">Migration to Databricks</a>
          <a href="/compute-guide">Compute Guide</a>
        </nav>
        <div className="agent-status-wrap">
          <button className={`agent-status ${connection}`} onClick={() => setToolsOpen((open) => !open)} aria-expanded={toolsOpen}>
            <span /> WebMCP Tools
          </button>
          {toolsOpen && (
            <div className="tools-popover migration-tools" role="dialog" aria-label="Migration advisor agent tools">
              <div className="tools-popover-heading">
                <div><p className="section-index">DECIDE WITH YOUR AGENT</p><h2>{connection === "connected" ? "Migration tools ready" : "Browser tools unavailable"}</h2></div>
                <span>{connection === "connected" ? `${tools.length} available` : "Local mode"}</span>
              </div>
              {connection === "connected" ? (
                <><p className="agent-prompt">Ask your browser agent to assess the current inputs, change constraints, or validate a capability.</p><div className="tool-list">{tools.map((tool) => <div className="tool-item" key={tool.name}><code>{tool.name}</code><p>{tool.description}</p></div>)}</div></>
              ) : <p className="tools-empty">The scoring engine remains fully usable. Agent tools appear when the browser exposes <code>document.modelContext</code>.</p>}
            </div>
          )}
        </div>
      </header>

      <section className="migration-hero" id="top">
        <div>
          <p className="eyebrow">MIGRATION DECISION / REDSHIFT → DATABRICKS</p>
          <h1>Redshift → Databricks<br /><em>Migration Strategy</em></h1>
        </div>
        <div className="migration-hero-side">
          <p>Find the lowest-risk path based on your data, workload, migration window and coexistence requirements.</p>
          <div className="migration-actions">
            <button className="migration-secondary" onClick={() => comparisonRef.current?.scrollIntoView({ behavior: "smooth" })}>Compare strategies ↓</button>
          </div>
        </div>
      </section>

      <section className="migration-presets" aria-label="Example migration presets">
        <span>START WITH A SCENARIO</span>
        <div>{PRESETS.map((preset) => (
          <button key={preset.name} onClick={() => { setInputs(preset.inputs); setDataUnit(preset.inputs.dataSizeGb >= 1000 ? "TB" : "GB"); }}>
            <b>{preset.name}</b><small>{preset.note}</small>
          </button>
        ))}</div>
      </section>

      <section className="migration-workspace" aria-label="Redshift to Databricks migration advisor">
        <aside className="migration-inputs">
          <div className="migration-panel-heading">
            <div><p className="section-index">01 / MIGRATION INPUTS</p><h2>Shape the decision.</h2></div>
          </div>

          <InputSection index="A" title="Data">
            <label className="migration-field full">
              <span>Total Redshift data size <i title="Approximate compressed data stored in Redshift.">?</i></span>
              <div className="migration-number-with-unit">
                <input type="number" min="0" step={dataUnit === "TB" ? "0.1" : "10"} value={displayDataSize} onChange={(event) => setInput("dataSizeGb", Math.max(0, Number(event.target.value)) * (dataUnit === "TB" ? 1000 : 1))} />
                <div>{(["GB", "TB"] as const).map((unit) => <button key={unit} className={dataUnit === unit ? "active" : ""} onClick={() => setDataUnit(unit)}>{unit}</button>)}</div>
              </div>
            </label>
            <NumberField label="Tables to migrate" value={inputs.tableCount} onChange={(value) => setInput("tableCount", value)} />
            <NumberField label="Largest table size" hint="The largest individual table helps distinguish a simple JDBC copy from a parallel bulk export." value={inputs.largestTableGb} onChange={(value) => setInput("largestTableGb", value)} suffix="GB" />
            <SelectField full label="Special or incompatible data types" value={inputs.specialDataTypes} options={["None known", "Some", "Extensive", "Unknown"]} onChange={(value) => setInput("specialDataTypes", value as MigrationInputs["specialDataTypes"])} />
          </InputSection>

          <InputSection index="B" title="Workload">
            <SelectField label="Daily data change" value={inputs.dailyChangeRate} options={["< 1%", "1–5%", "5–20%", "> 20%", "Unknown"]} onChange={(value) => setInput("dailyChangeRate", value as MigrationInputs["dailyChangeRate"])} />
            <SelectField label="Primary write pattern" value={inputs.writePattern} options={["Mostly append", "MERGE / upsert", "Frequent UPDATE", "Frequent DELETE", "Mixed workload", "Mostly read-only"]} onChange={(value) => setInput("writePattern", value as MigrationInputs["writePattern"])} />
            <SelectField label="Code & dependency complexity" value={inputs.redshiftSqlComplexity} options={["Low", "Medium", "High", "Unknown"]} onChange={(value) => setInput("redshiftSqlComplexity", value as MigrationInputs["redshiftSqlComplexity"])} />
          </InputSection>

          <InputSection index="C" title="Migration constraints">
            <div className="migration-field full">
              <span>Keep Redshift active?</span>
              <div className="migration-segmented">{[true, false].map((value) => <button key={String(value)} className={inputs.keepRedshiftActive === value ? "active" : ""} onClick={() => setInputs((current) => ({ ...current, keepRedshiftActive: value, coexistenceDuration: value ? current.coexistenceDuration ?? "1–3 months" : undefined }))}>{value ? "Yes" : "No"}</button>)}</div>
            </div>
            {inputs.keepRedshiftActive && <SelectField label="Coexistence period" value={inputs.coexistenceDuration ?? "Unknown"} options={["< 1 month", "1–3 months", "3–6 months", "> 6 months", "Unknown"]} onChange={(value) => setInput("coexistenceDuration", value as MigrationInputs["coexistenceDuration"])} />}
            <SelectField label="Maximum downtime" value={inputs.downtimeTolerance} options={["Near zero", "< 1 hour", "< 1 day", "Multiple days acceptable"]} onChange={(value) => setInput("downtimeTolerance", value as MigrationInputs["downtimeTolerance"])} />
            <SelectField label="Shared S3 available?" value={inputs.sharedS3Available} options={["Yes", "No", "Unknown"]} onChange={(value) => setInput("sharedS3Available", value as MigrationInputs["sharedS3Available"])} />
            <SelectField full label="Change synchronization / cutover plan" value={inputs.changeSyncPlan} options={["Write freeze", "Scheduled incremental loads", "CDC / replication tool", "Dual-write", "No plan", "Unknown"]} onChange={(value) => setInput("changeSyncPlan", value as MigrationInputs["changeSyncPlan"])} />
          </InputSection>

          <InputSection index="D" title="Target state">
            <SelectField full label="Intended target state" value={inputs.targetState} options={["Databricks becomes primary platform", "Long-term Redshift + Databricks coexistence", "Evaluate Databricks before migration", "Only move selected workloads", "Not decided"]} onChange={(value) => setInput("targetState", value as MigrationInputs["targetState"])} />
            <SelectField full label="Preferred table format" value={inputs.targetFormat} options={["Delta Lake", "Iceberg", "No preference", "Not decided"]} onChange={(value) => setInput("targetFormat", value as MigrationInputs["targetFormat"])} />
            <SelectField full label="What should move first?" value={inputs.migrationPriority} options={["Data pipelines / ETL", "BI and reporting", "Selected workload POC", "Not decided"]} onChange={(value) => setInput("migrationPriority", value as MigrationInputs["migrationPriority"])} />
          </InputSection>
        </aside>

        <div className="migration-results">
          <div className="result-kicker"><span>02 / RECOMMENDATION</span></div>
          <ExportToolbar
            title="StrategyShifu Redshift to Databricks migration assessment"
            copyText={() => migrationSummary(inputs, recommendation)}
            csvText={() => migrationCsv(inputs, recommendation)}
            fileBase="strategyshifu-redshift-to-databricks"
            shareUrl={() => createShareUrl("migration", inputs)}
          />
          <section className="print-assessment-context">
            <p className="section-index">ASSESSMENT CONTEXT</p>
            <h2>Redshift → Databricks migration assessment</h2>
            <div>
              <span><b>Data</b>{formatDataSize(inputs.dataSizeGb)} · {inputs.tableCount} tables · largest {inputs.largestTableGb} GB</span>
              <span><b>Workload</b>{inputs.dailyChangeRate} daily change · {inputs.writePattern}</span>
              <span><b>Transition</b>{inputs.keepRedshiftActive ? `Redshift active · ${inputs.coexistenceDuration}` : "Direct cutover"} · {inputs.changeSyncPlan}</span>
              <span><b>Target</b>{inputs.targetState} · {inputs.targetFormat}</span>
            </div>
          </section>
          <article className="migration-recommendation">
            <div className="recommendation-lead">
              <div>
                <p className="section-index">RECOMMENDED MIGRATION STRATEGY</p>
                <h2>{recommendation.recommendedStrategy.name}</h2>
                <p>{MIGRATION_STRATEGIES[recommendation.recommendedStrategy.id].description}</p>
              </div>
              <div className="migration-score"><strong>{recommendation.recommendedStrategy.score}</strong><span>/ 100</span><small>{recommendation.confidence} confidence</small></div>
            </div>
            <p className="confidence-line">{recommendation.confidenceExplanation}</p>

            <div className="decision-path-strip" aria-label="Recommended migration approach">
              <DecisionSignal label="Migration approach" value={recommendation.migrationApproach} />
              <DecisionSignal label="Execution order" value={recommendation.executionOrder} />
              <DecisionSignal label="Data movement" value={recommendation.recommendedStrategy.name} />
              <DecisionSignal label="Execution readiness" value={`${recommendation.executionReadiness.level} · ${recommendation.executionReadiness.score}/100`} />
            </div>

            <div className="recommendation-detail-grid">
              <div>
                <p className="detail-label">WHY THIS STRATEGY</p>
                <ul className="migration-list positive">{recommendation.reasons.map((reason) => <li key={reason}><span>✓</span>{reason}</li>)}</ul>
              </div>
              <div>
                <p className="detail-label">CHECK BEFORE IMPLEMENTATION</p>
                <ul className="migration-list warning">{recommendation.risks.map((risk) => <li key={risk}><span>!</span>{risk}</li>)}</ul>
              </div>
            </div>

            <div className="alternative-card">
              <span><small>ALTERNATIVE</small><b>{alternative.name}</b><p>{alternativeText(alternative.id, inputs)}</p></span>
              <strong>{alternative.score}<small>/100</small></strong>
            </div>
          </article>

          {recommendation.missingInformation && (
            <div className="improve-card"><span>?</span><div><p className="detail-label">IMPROVE THIS RECOMMENDATION</p><b>{recommendation.missingInformation}</b></div></div>
          )}

          <section className="migration-section architecture-section" aria-labelledby="architecture-title">
            <div className="migration-section-heading"><div><p className="section-index">TARGET PATH</p><h2 id="architecture-title">Migration architecture</h2></div><span>{recommendation.recommendedStrategy.name}</span></div>
            <Architecture strategy={recommendation.recommendedStrategy.id} />
          </section>

          <section className="migration-section" ref={comparisonRef} aria-labelledby="comparison-title">
            <div className="migration-section-heading"><div><p className="section-index">ALL FOUR OPTIONS</p><h2 id="comparison-title">Strategy comparison</h2></div><span>SS score / 100</span></div>
            <div className="migration-comparison-wrap"><table className="migration-comparison">
              <thead><tr><th>Criterion</th>{STRATEGY_ORDER.map((id) => <th className={id === recommendation.recommendedStrategy.id ? "winner" : ""} key={id}>{MIGRATION_STRATEGIES[id].shortName}<b>{recommendation.scores.find((score) => score.strategyId === id)?.score}</b></th>)}</tr></thead>
              <tbody>{CRITERIA.map((criterion) => <tr key={criterion}><th>{criterion}</th>{STRATEGY_ORDER.map((id) => <td className={id === recommendation.recommendedStrategy.id ? "winner" : ""} key={id}>{getComparisonValue(criterion, id, inputs)}</td>)}</tr>)}</tbody>
            </table></div>
          </section>

          <section className="migration-section steps-section" aria-labelledby="steps-title">
            <div className="migration-section-heading"><div><p className="section-index">IMPLEMENTATION OUTLINE</p><h2 id="steps-title">Suggested migration steps</h2></div><span>Start with validation</span></div>
            <ol className="migration-steps">{recommendation.migrationSteps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol>
          </section>

          <section className="migration-section cutover-section" aria-labelledby="cutover-title">
            <div className="migration-section-heading"><div><p className="section-index">PRODUCTION GATES</p><h2 id="cutover-title">Required before cutover</h2></div><span>Approval + rollback</span></div>
            <ul className="cutover-checks">{recommendation.cutoverChecks.map((check) => <li key={check}><span>✓</span><p>{check}</p></li>)}</ul>
          </section>

          <details className="migration-evidence" open>
            <summary><span><small>TECHNICAL EVIDENCE</small><b>Why StrategyShifu recommends this</b></span><span className={`capability-dot ${capabilityState}`} /> <ChevronDown /></summary>
            <div className="capability-bar"><span>{capabilityMessage}</span><button onClick={(event) => { event.preventDefault(); void loadCapabilities(true); }} disabled={refreshing}><Refresh /> {refreshing ? "Refreshing…" : "Refresh capabilities"}</button></div>
            {capabilities.length > 0 && <div className="evidence-grid">{capabilities.map((item) => <article key={item.id}><p>{item.provider}</p><b>{item.statement}</b>{item.limitations.slice(0, 1).map((limit) => <span key={limit}>{limit}</span>)}<small>Checked {formatCheckedAt(item.checkedAt)} · {item.fresh ? "Live" : "Last known"}</small></article>)}</div>}
            <p className="evidence-note">Capability checks validate the deterministic result; they do not choose the strategy.</p>
          </details>
        </div>
      </section>

      <section className="migration-closing"><p>StrategyShifu does not just tell you where to migrate.</p><h2>It helps you decide <em>how to get there.</em></h2></section>
      <footer><div><span className="brand-mark small"><span /></span><b>StrategyShifu</b></div><p>Deterministic migration guidance with current capability validation.</p><span>REDSHIFT → DATABRICKS</span></footer>
    </main>
  );
}

function InputSection({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return <section className="migration-input-section"><div className="input-section-title"><span>{index}</span><h3>{title}</h3></div><div className="migration-field-grid">{children}</div></section>;
}

function DecisionSignal({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><b>{value}</b></div>;
}

function NumberField({ label, value, suffix, hint, onChange }: { label: string; value: number; suffix?: string; hint?: string; onChange: (value: number) => void }) {
  return <label className="migration-field"><span>{label}{hint && <i title={hint}>?</i>}</span><div className="plain-number"><input type="number" min="0" step="1" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} />{suffix && <small>{suffix}</small>}</div></label>;
}

function SelectField({ label, value, options, onChange, full = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; full?: boolean }) {
  return <label className={`migration-field ${full ? "full" : ""}`}><span>{label}</span><div className="migration-select"><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown /></div></label>;
}

function Architecture({ strategy }: { strategy: StrategyId }) {
  if (strategy === "iceberg") return <div className="architecture-diagram iceberg-diagram"><Node className="arch-shared" eyebrow="DURABLE DATA LAYER" label="Amazon S3" detail="Iceberg tables" /><div className="arch-line left" /><div className="arch-line right" /><Node className="arch-left" eyebrow="SOURCE" label="Amazon Redshift" detail="Existing BI" /><Node className="arch-right" eyebrow="TARGET" label="Databricks" detail="New workloads" /><span className="transition-label">PHASED TRANSITION</span></div>;
  const nodes = strategy === "federation" ? [["TARGET", "Databricks"], ["ACCESS", "Lakehouse Federation"], ["SOURCE", "Amazon Redshift"]] : strategy === "unload" ? [["SOURCE", "Amazon Redshift"], ["EXPORT", "UNLOAD"], ["LANDING", "Amazon S3"], ["TARGET", "Databricks · Delta / Iceberg"]] : [["SOURCE", "Amazon Redshift"], ["TRANSFER", "JDBC"], ["TARGET", "Databricks · Delta / Iceberg"]];
  return <div className="architecture-diagram linear-diagram">{nodes.map(([eyebrow, label], index) => <div className="linear-node-wrap" key={label}><Node eyebrow={eyebrow} label={label} />{index < nodes.length - 1 && <span className="linear-arrow">→</span>}</div>)}</div>;
}

function Node({ eyebrow, label, detail, className = "" }: { eyebrow: string; label: string; detail?: string; className?: string }) {
  return <div className={`arch-node ${className}`}><small>{eyebrow}</small><b>{label}</b>{detail && <span>{detail}</span>}</div>;
}

function alternativeText(strategy: StrategyId, inputs: MigrationInputs) {
  if (strategy === "unload") return inputs.keepRedshiftActive ? "Better if the coexistence window can be shortened and a final cutover is acceptable." : "A clean bulk path when Redshift retirement matters most.";
  if (strategy === "iceberg") return "Better if interoperable S3 tables and extended coexistence become priorities.";
  if (strategy === "federation") return "Better for evaluation or workload discovery before committing to data movement.";
  return "Better if the scope is reduced to a small, selective set of tables.";
}

function normalizeCapabilities(raw: RawCapabilities): CapabilityEvidence[] {
  const redshift = raw.redshiftIceberg ?? {};
  const databricks = raw.databricksIceberg ?? {};
  const federation = raw.federation ?? {};
  const exportInfo = raw.export ?? {};
  const operations = Array.isArray(redshift.supportedOperations) ? redshift.supportedOperations.join(", ") : "query and DML operations";
  const methods = Array.isArray(exportInfo.methods) ? exportInfo.methods as Array<Record<string, unknown>> : [];
  return [
    { id: "redshiftIceberg", provider: "Amazon Redshift", statement: `Iceberg v2/v3 operations validated: ${operations}.`, limitations: stringArray(redshift.limitations), checkedAt: String(redshift.checkedAt ?? ""), fresh: redshift.fresh === true },
    { id: "databricksIceberg", provider: "Databricks", statement: String(databricks.writeSupport ?? "Iceberg access varies by catalog ownership."), limitations: stringArray(databricks.limitations), checkedAt: String(databricks.checkedAt ?? ""), fresh: databricks.fresh === true },
    { id: "federation", provider: "Databricks Federation", statement: String(federation.readWriteSupport ?? "Redshift federation capability validated."), limitations: stringArray(federation.limitations), checkedAt: String(federation.checkedAt ?? ""), fresh: federation.fresh === true },
    { id: "export", provider: "Amazon Redshift", statement: methods[0]?.supportsParquet ? "UNLOAD supports scalable parallel export to S3 in Parquet." : "UNLOAD exports Redshift query results to S3.", limitations: [], checkedAt: String(exportInfo.checkedAt ?? ""), fresh: exportInfo.fresh === true },
  ];
}

function stringArray(value: unknown) { return Array.isArray(value) ? value.map(String) : []; }
function formatCheckedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unavailable" : new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDataSize(valueGb: number) { return valueGb >= 1000 ? `${valueGb / 1000} TB` : `${valueGb} GB`; }

function migrationSummary(inputs: MigrationInputs, recommendation: ReturnType<typeof evaluateMigration>) {
  return [
    "StrategyShifu — Redshift to Databricks migration assessment",
    `Recommended strategy: ${recommendation.recommendedStrategy.name} (${recommendation.recommendedStrategy.score}/100, ${recommendation.confidence} confidence)`,
    `Migration approach: ${recommendation.migrationApproach}`,
    `Execution order: ${recommendation.executionOrder}`,
    `Execution readiness: ${recommendation.executionReadiness.level} (${recommendation.executionReadiness.score}/100)`,
    `Data: ${formatDataSize(inputs.dataSizeGb)}, ${inputs.tableCount} tables, largest table ${inputs.largestTableGb} GB`,
    `Synchronization: ${inputs.changeSyncPlan}`,
    "",
    "Why:", ...recommendation.reasons.map((reason) => `- ${reason}`),
    "",
    "Checks:", ...recommendation.risks.map((risk) => `- ${risk}`),
    "",
    "Required before cutover:", ...recommendation.cutoverChecks.map((check) => `- ${check}`),
  ].join("\n");
}

function migrationCsv(inputs: MigrationInputs, recommendation: ReturnType<typeof evaluateMigration>) {
  const rows: Array<[string, string, string | number | boolean | undefined]> = [
    ["Input", "Total data size (GB)", inputs.dataSizeGb], ["Input", "Table count", inputs.tableCount], ["Input", "Largest table (GB)", inputs.largestTableGb],
    ["Input", "Daily change", inputs.dailyChangeRate], ["Input", "Write pattern", inputs.writePattern], ["Input", "Code and dependency complexity", inputs.redshiftSqlComplexity],
    ["Input", "Keep Redshift active", inputs.keepRedshiftActive], ["Input", "Coexistence duration", inputs.coexistenceDuration], ["Input", "Downtime tolerance", inputs.downtimeTolerance],
    ["Input", "Shared S3", inputs.sharedS3Available], ["Input", "Target state", inputs.targetState], ["Input", "Target format", inputs.targetFormat],
    ["Input", "Migration priority", inputs.migrationPriority], ["Input", "Change synchronization", inputs.changeSyncPlan], ["Input", "Special data types", inputs.specialDataTypes],
    ["Decision", "Recommended strategy", recommendation.recommendedStrategy.name], ["Decision", "Strategy score", recommendation.recommendedStrategy.score],
    ["Decision", "Confidence", recommendation.confidence], ["Decision", "Migration approach", recommendation.migrationApproach], ["Decision", "Execution order", recommendation.executionOrder],
    ["Decision", "Execution readiness", recommendation.executionReadiness.level], ["Decision", "Readiness score", recommendation.executionReadiness.score],
    ...recommendation.scores.map((score): [string, string, number] => ["Strategy score", MIGRATION_STRATEGIES[score.strategyId].name, score.score]),
  ];
  return [["Section", "Field", "Value"], ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
