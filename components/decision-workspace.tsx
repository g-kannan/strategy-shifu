"use client";

import { useCallback, useMemo, useState } from "react";
import { useWebMCP } from "@/hooks/use-webmcp";
import { compareStrategies, formatCurrency } from "@/lib/decision-engine";
import { BATCH_PRESET, STREAMING_PRESET } from "@/lib/presets";
import { REGIONS_BY_CLOUD } from "@/lib/regions";
import type { Cloud, DecisionState, DisplayCurrency, Evaluation, WorkloadType } from "@/lib/types";
import { ArrowUpRight, Check, ChevronDown, Clock, Close, Network, Refresh, Spark } from "./icons";

type ScheduleView = "monthly" | "weekly";

export function DecisionWorkspace() {
  const [decision, setDecision] = useState<DecisionState>(STREAMING_PRESET);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("monthly");
  const [scenarioMenu, setScenarioMenu] = useState(false);
  const [dataUnit, setDataUnit] = useState<"GB" | "TB">("GB");
  const onDecisionChange = useCallback((next: DecisionState) => setDecision(next), []);
  const connection = useWebMCP(decision, onDecisionChange);
  const comparison = useMemo(() => compareStrategies(decision), [decision]);

  const setWorkload = <K extends keyof DecisionState["workload"]>(
    key: K,
    value: DecisionState["workload"][K],
  ) => setDecision((current) => ({ ...current, workload: { ...current.workload, [key]: value } }));

  const setRequirement = <K extends keyof DecisionState["requirements"]>(
    key: K,
    value: DecisionState["requirements"][K],
  ) => setDecision((current) => ({ ...current, requirements: { ...current.requirements, [key]: value } }));

  const setCloud = (cloud: Cloud) =>
    setDecision((current) => ({
      ...current,
      requirements: { ...current.requirements, cloud },
      assumptions: {
        ...current.assumptions,
        region: REGIONS_BY_CLOUD[cloud][0].value,
      },
    }));

  const setAssumption = <K extends keyof DecisionState["assumptions"]>(
    key: K,
    value: DecisionState["assumptions"][K],
  ) => setDecision((current) => ({ ...current, assumptions: { ...current.assumptions, [key]: value } }));

  const loadScenario = (scenario: DecisionState) => {
    setDecision(structuredClone(scenario));
    setDataUnit("GB");
    setScenarioMenu(false);
  };

  const displayBudget = decision.currency === "INR" ? decision.budget * decision.usdToInrRate : decision.budget;
  const visibleVolume = dataUnit === "TB" ? decision.workload.dataVolumeGbPerDay / 1000 : decision.workload.dataVolumeGbPerDay;

  const setCurrency = (currency: DisplayCurrency) =>
    setDecision((current) => ({ ...current, currency }));

  const setVolume = (value: number) =>
    setWorkload("dataVolumeGbPerDay", dataUnit === "TB" ? value * 1000 : value);

  const setConversionRate = (value: number) =>
    setDecision((current) => ({ ...current, usdToInrRate: value > 0 ? value : 95 }));

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="StrategyShifu home">
          <span className="brand-lockup">
            <span className="brand-wordmark"><span>Strategy</span><b>Shifu</b></span>
            <small>Decide with your agent.</small>
          </span>
        </a>
        <nav className="process-nav" aria-label="Decision progress">
          <span className="process-step done"><i><Check /></i> Describe</span>
          <span className="process-line" />
          <span className="process-step done"><i><Check /></i> Constrain</span>
          <span className="process-line" />
          <span className="process-step active"><i>03</i> Compare</span>
        </nav>
        <div
          className={`agent-status ${connection}`}
          title={connection === "connected" ? "WebMCP tools are available to browser agents on this page." : "WebMCP connection status"}
          aria-label={connection === "connected" ? "WebMCP tools available" : connection === "checking" ? "Checking WebMCP tools" : "WebMCP tools unavailable"}
        >
          <span />
          {connection === "connected" ? "WebMCP tools available" : connection === "checking" ? "Checking WebMCP" : "WebMCP unavailable"}
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">TECHNICAL DECISION / DATABRICKS</p>
          <h1>Find the strategy your workload can <em>actually</em> use.</h1>
          <p className="hero-copy">Technical fit first. Budget fit second. A recommendation you can inspect.</p>
        </div>
        <div className="scenario-wrap">
          <button className="scenario-button" onClick={() => setScenarioMenu((open) => !open)} aria-expanded={scenarioMenu}>
            <Spark /> Load example <ChevronDown />
          </button>
          {scenarioMenu && (
            <div className="scenario-menu">
              <button onClick={() => loadScenario(STREAMING_PRESET)}>
                <span>Streaming / private network</span>
                <small>24×7 · $1,000 budget</small>
              </button>
              <button onClick={() => loadScenario(BATCH_PRESET)}>
                <span>Daily batch / serverless</span>
                <small>Business hours · $900 budget</small>
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="workspace" aria-label="Technical decision workspace">
        <aside className="input-panel">
          <div className="panel-heading">
            <div>
              <p className="section-index">01 / INPUTS</p>
              <h2>Decision profile</h2>
            </div>
            <button className="icon-button" onClick={() => loadScenario(STREAMING_PRESET)} title="Reset example">
              <Refresh />
            </button>
          </div>

          <div className="form-section">
            <label className="field-label">Workload type</label>
            <div className="segmented" role="group" aria-label="Workload type">
              {(["streaming", "batch"] as WorkloadType[]).map((type) => (
                <button
                  key={type}
                  className={decision.workload.type === type ? "selected" : ""}
                  onClick={() => setWorkload("type", type)}
                >
                  {type === "streaming" ? "Streaming" : "Batch"}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="field-label" htmlFor="description">Workload description</label>
            <textarea
              id="description"
              rows={3}
              value={decision.workload.description}
              onChange={(event) => setWorkload("description", event.target.value)}
            />
          </div>

          <div className="field-grid">
            <div className="form-section">
              <div className="field-label-row">
                <label className="field-label" htmlFor="volume">Data / day</label>
                <div className="unit-toggle" role="group" aria-label="Data volume unit">
                  {(["GB", "TB"] as const).map((unit) => (
                    <button key={unit} className={dataUnit === unit ? "selected" : ""} onClick={() => setDataUnit(unit)}>{unit}</button>
                  ))}
                </div>
              </div>
              <div className="number-field">
                <input
                  id="volume"
                  type="number"
                  step={dataUnit === "TB" ? "0.01" : "1"}
                  value={visibleVolume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
                <span>{dataUnit}</span>
              </div>
            </div>
            <div className="form-section">
              <label className="field-label" htmlFor="sla">SLA</label>
              <div className="number-field">
                <input
                  id="sla"
                  type="number"
                  value={decision.workload.slaMinutes}
                  onChange={(event) => setWorkload("slaMinutes", Number(event.target.value))}
                />
                <span>MIN</span>
              </div>
            </div>
          </div>

          <div className="field-grid">
            <div className="form-section">
              <label className="field-label" htmlFor="cloud">Cloud</label>
              <div className="select-field">
                <select
                  id="cloud"
                  value={decision.requirements.cloud}
                  onChange={(event) => setCloud(event.target.value as Cloud)}
                >
                  <option>AWS</option><option>Azure</option><option>GCP</option>
                </select>
                <ChevronDown />
              </div>
            </div>
            <div className="form-section">
              <label className="field-label" htmlFor="region">Region</label>
              <div className="select-field">
                <select
                  id="region"
                  value={decision.assumptions.region}
                  onChange={(event) => setAssumption("region", event.target.value)}
                >
                  {REGIONS_BY_CLOUD[decision.requirements.cloud].map((region) => (
                    <option key={region.value} value={region.value}>{region.label}</option>
                  ))}
                </select>
                <ChevronDown />
              </div>
            </div>
          </div>

          <div className="requirement-row">
            <div><Network /><span><b>Private networking</b><small>Hard technical requirement</small></span></div>
            <button
              className={`switch ${decision.requirements.privateNetworking ? "on" : ""}`}
              role="switch"
              aria-checked={decision.requirements.privateNetworking}
              onClick={() => setRequirement("privateNetworking", !decision.requirements.privateNetworking)}
            ><span /></button>
          </div>

          <div className="budget-block">
            <div className="currency-row">
              <div className="currency-toggle" role="group" aria-label="Display currency">
                {(["USD", "INR"] as DisplayCurrency[]).map((currency) => (
                  <button key={currency} className={decision.currency === currency ? "selected" : ""} onClick={() => setCurrency(currency)}>{currency}</button>
                ))}
              </div>
              <label className="rate-control" htmlFor="conversion-rate">1 USD = <input id="conversion-rate" type="number" min="1" step="1" value={decision.usdToInrRate} onChange={(event) => setConversionRate(Number(event.target.value))} /> INR</label>
            </div>
            <div className="budget-heading">
              <label htmlFor="budget">Monthly budget</label>
              <span>{decision.currency} / MONTH</span>
            </div>
            <div className="budget-input">
              <span>{decision.currency === "INR" ? "₹" : "$"}</span>
              <input
                id="budget"
                type="number"
                min="0"
                step={decision.currency === "INR" ? "1000" : "50"}
                value={displayBudget}
                onChange={(event) => setDecision((current) => ({ ...current, budget: Number(event.target.value) / (current.currency === "INR" ? current.usdToInrRate : 1) }))}
              />
            </div>
            <div className="budget-presets">
              {[1000, 1500, 2000].map((budget) => (
                <button key={budget} className={decision.budget === budget ? "selected" : ""} onClick={() => setDecision((current) => ({ ...current, budget }))}>
                  {formatCurrency(budget, decision.currency, decision.usdToInrRate)}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="results-panel">
          <div className="results-heading">
            <div>
              <p className="section-index">02 / COMPARISON</p>
              <h2>Strategy field</h2>
            </div>
            <p>Ranked by <b>technical fit</b>, then budget and operational simplicity.</p>
          </div>

          <RecommendationBanner
            decision={decision}
            comparison={comparison}
            onBudgetChange={(budget) => setDecision((current) => ({ ...current, budget }))}
          />

          <div className="strategy-grid">
            {comparison.evaluations.map((evaluation, index) => (
              <StrategyCard key={evaluation.strategy.id} evaluation={evaluation} rank={index + 1} decision={decision} />
            ))}
          </div>

          <section className="schedule-card">
            <div className="schedule-title">
              <div>
                <p className="section-index">WORKLOAD RUNTIME</p>
                <h2>Operational schedule</h2>
              </div>
              <Clock />
            </div>
            <div className="schedule-tabs" role="tablist" aria-label="Schedule period">
              <button role="tab" aria-selected={scheduleView === "monthly"} className={scheduleView === "monthly" ? "active" : ""} onClick={() => setScheduleView("monthly")}>Monthly schedule</button>
              <button role="tab" aria-selected={scheduleView === "weekly"} className={scheduleView === "weekly" ? "active" : ""} onClick={() => setScheduleView("weekly")}>Weekly schedule</button>
            </div>
            <RangeField
              label="Execution hours per day"
              value={decision.assumptions.hoursPerDay}
              min={1}
              max={24}
              suffix="hours"
              onChange={(value) => setAssumption("hoursPerDay", value)}
            />
            {scheduleView === "monthly" ? (
              <RangeField
                label="Execution days per month"
                value={decision.assumptions.daysPerMonth}
                min={1}
                max={31}
                suffix="days"
                onChange={(value) => setAssumption("daysPerMonth", value)}
              />
            ) : (
              <RangeField
                label="Execution days per week"
                value={Math.min(7, Math.max(1, Math.round(decision.assumptions.daysPerMonth / 4.33)))}
                min={1}
                max={7}
                suffix="days"
                onChange={(value) => setAssumption("daysPerMonth", Math.min(31, Math.round(value * 4.33)))}
              />
            )}
            <p className="hours-note">{decision.assumptions.hoursPerDay * decision.assumptions.daysPerMonth} monthly hours used in every estimate.</p>
            <div className="timing-presets">
              <p>OPERATIONAL TIMING PRESETS:</p>
              <div>
                <button onClick={() => setDecision((current) => ({ ...current, assumptions: { ...current.assumptions, hoursPerDay: 24, daysPerMonth: 30 } }))}>24/7 Always on</button>
                <button onClick={() => setDecision((current) => ({ ...current, assumptions: { ...current.assumptions, hoursPerDay: 8, daysPerMonth: 22 } }))}>Business hours</button>
                <button onClick={() => setDecision((current) => ({ ...current, assumptions: { ...current.assumptions, hoursPerDay: 4, daysPerMonth: 30 } }))}>Daily batch</button>
              </div>
            </div>
          </section>
        </div>
      </section>

      <footer>
        <div><span className="brand-mark small"><span /></span><b>StrategyShifu</b></div>
        <p>Reference pricing for demonstration only. Estimates are directional, not a Databricks quote.</p>
        <span>DECIDE WITH YOUR AGENT.</span>
      </footer>
    </main>
  );
}

function RecommendationBanner({
  decision,
  comparison,
  onBudgetChange,
}: {
  decision: DecisionState;
  comparison: ReturnType<typeof compareStrategies>;
  onBudgetChange: (budget: number) => void;
}) {
  const winner = comparison.recommendation;
  if (!winner) {
    const lowestValid = comparison.evaluations.filter((item) => item.technicalFit).sort((a, b) => a.estimatedCost - b.estimatedCost)[0];
    return (
      <div className="recommendation-banner warning">
        <div className="recommendation-icon"><Close /></div>
        <div className="recommendation-copy">
          <p className="section-index">DECISION STATUS</p>
          <h3>No valid strategy fits {formatCurrency(decision.budget, decision.currency, decision.usdToInrRate)}.</h3>
          <p>{lowestValid ? `The lowest technically valid option needs ${formatCurrency(lowestValid.estimatedCost - decision.budget, decision.currency, decision.usdToInrRate)} more per month.` : "Relax a hard technical requirement to reveal a valid option."}</p>
        </div>
        {lowestValid && (
          <button onClick={() => onBudgetChange(Math.ceil(lowestValid.estimatedCost / 50) * 50)}>
            Raise budget to {formatCurrency(Math.ceil(lowestValid.estimatedCost / 50) * 50, decision.currency, decision.usdToInrRate)} <ArrowUpRight />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="recommendation-banner success">
      <div className="recommendation-icon"><Spark /></div>
      <div className="recommendation-copy">
        <p className="section-index">RECOMMENDED STRATEGY</p>
        <h3>{winner.strategy.shortName}</h3>
        <p>{comparison.summary}</p>
      </div>
      <div className="recommendation-metric">
        <span>EST. MONTHLY</span><strong>{formatCurrency(winner.estimatedCost, decision.currency, decision.usdToInrRate)}</strong>
        <small>{formatCurrency(decision.budget - winner.estimatedCost, decision.currency, decision.usdToInrRate)} remaining</small>
      </div>
    </div>
  );
}

function StrategyCard({ evaluation, rank, decision }: { evaluation: Evaluation; rank: number; decision: DecisionState }) {
  const { strategy } = evaluation;
  return (
    <article className={`strategy-card ${evaluation.recommended ? "recommended" : ""}`}>
      {evaluation.recommended && <div className="recommended-flag"><Spark /> RECOMMENDED</div>}
      <div className="card-topline"><span>0{rank}</span><small>{strategy.category}</small></div>
      <h3>{strategy.shortName}</h3>
      <p className="strategy-full-name">{strategy.name}</p>
      <p className="strategy-description">{strategy.description}</p>
      <div className="cost-row">
        <span><small>EST. MONTHLY</small><b>{formatCurrency(evaluation.estimatedCost, decision.currency, decision.usdToInrRate)}</b></span>
        <span className="score"><small>SCORE</small><b>{evaluation.score}</b></span>
      </div>
      <div className="fit-grid">
        <Status label="Technical fit" pass={evaluation.technicalFit} passText="Pass" failText="Fail" />
        <Status label="Budget fit" pass={evaluation.budgetFit} passText="Within" failText="Over" />
      </div>
      <div className="card-reason">
        <p>KEY DECISION SIGNAL</p>
        <span className={evaluation.technicalFit ? "signal-pass" : "signal-fail"}>
          {evaluation.technicalFit ? <Check /> : <Close />}
          {evaluation.reasoning[0]}
        </span>
      </div>
      <div className="tradeoffs">
        <p>TRADE-OFFS</p>
        <ul>
          <li>+ {strategy.advantages[0]}</li>
          <li>− {strategy.disadvantages[0]}</li>
        </ul>
      </div>
      <div className="budget-track" aria-label={`${strategy.shortName} uses ${Math.round((evaluation.estimatedCost / decision.budget) * 100)} percent of budget`}>
        <span style={{ width: `${Math.min(100, (evaluation.estimatedCost / Math.max(decision.budget, 1)) * 100)}%` }} />
      </div>
      <small className="budget-caption">{Math.round((evaluation.estimatedCost / Math.max(decision.budget, 1)) * 100)}% OF BUDGET</small>
    </article>
  );
}

function Status({ label, pass, passText, failText }: { label: string; pass: boolean; passText: string; failText: string }) {
  return (
    <div className="fit-status">
      <span>{label}</span>
      <b className={pass ? "pass" : "fail"}>{pass ? <Check /> : <Close />}{pass ? passText : failText}</b>
    </div>
  );
}

function RangeField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div className="range-field">
      <div><label>{label}</label><b>{value} <span>{suffix}</span></b></div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--range-fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
    </div>
  );
}
