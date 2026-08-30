import type { Metadata } from "next";
import { Check, Close, Spark } from "@/components/icons";

export const metadata: Metadata = {
  title: "Compute Guide — StrategyShifu",
  description: "Compare Databricks SQL warehouse performance capabilities across Serverless, Pro, and Classic.",
};

type WarehouseType = "Serverless" | "Pro" | "Classic";

type Capability = {
  name: string;
  description: string;
  icon: "photon" | "predictive" | "workload" | "genie";
  featured?: boolean;
  availability: Record<WarehouseType, boolean>;
};

const warehouseTypes: WarehouseType[] = ["Serverless", "Pro", "Classic"];

const capabilities: Capability[] = [
  {
    name: "Photon engine",
    description: "A vectorized query engine that accelerates existing SQL and DataFrame workloads.",
    icon: "photon",
    availability: { Serverless: true, Pro: true, Classic: true },
  },
  {
    name: "Predictive I/O",
    description: "Uses intelligent access patterns to scan less data and speed up selective queries.",
    icon: "predictive",
    availability: { Serverless: true, Pro: true, Classic: false },
  },
  {
    name: "Intelligent workload management",
    description: "Predicts query resource needs and dynamically manages capacity, queues, and scaling.",
    icon: "workload",
    availability: { Serverless: true, Pro: false, Classic: false },
  },
  {
    name: "Genie",
    description: "Natural-language analytics through Genie Agents for chat-based questions over your data.",
    icon: "genie",
    featured: true,
    availability: { Serverless: true, Pro: true, Classic: false },
  },
];

function CapabilityIcon({ kind }: { kind: Capability["icon"] }) {
  if (kind === "photon") return <span className="capability-symbol photon-symbol" aria-hidden="true">ϟ</span>;
  if (kind === "predictive") return <span className="capability-symbol predictive-symbol" aria-hidden="true">◔</span>;
  if (kind === "workload") return <Spark className="capability-svg" aria-hidden="true" />;
  return <span className="capability-symbol genie-symbol" aria-hidden="true">◌</span>;
}

function Availability({ available, warehouse }: { available: boolean; warehouse: WarehouseType }) {
  return (
    <span className={`capability-availability ${available ? "available" : "unavailable"}`}>
      {available ? <Check /> : <Close />}
      <span className="sr-only">{available ? `${warehouse} supports this capability` : `${warehouse} does not support this capability`}</span>
    </span>
  );
}

export default function ComputeGuide() {
  return (
    <main className="guide-page">
      <header className="site-header">
        <a className="brand" href="/" aria-label="StrategyShifu home">
          <span className="brand-lockup">
            <span className="brand-wordmark"><span>Strategy</span><b>Shifu</b></span>
            <small>Decide with your agent.</small>
          </span>
        </a>
        <div className="header-center">
          <nav className="page-nav" aria-label="Primary navigation">
            <a href="/">Databricks</a>
            <a className="active" href="/compute-guide" aria-current="page">Compute Guide</a>
          </nav>
        </div>
        <span className="guide-status">REFERENCE GUIDE</span>
      </header>

      <section className="guide-hero">
        <div>
          <p className="eyebrow">AT A GLANCE</p>
          <h1>Performance capabilities</h1>
        </div>
        <p>All warehouse types include Photon. Predictive I/O and Genie are available on Serverless and Pro, while intelligent workload management is exclusive to Serverless.</p>
      </section>

      <section className="capability-section" aria-labelledby="capability-title">
        <h2 id="capability-title" className="sr-only">Databricks SQL warehouse capabilities</h2>
        <div className="capability-table-wrap">
          <table className="capability-table">
            <thead>
              <tr>
                <th scope="col">Capability</th>
                {warehouseTypes.map((warehouse) => <th scope="col" key={warehouse}>{warehouse}</th>)}
              </tr>
            </thead>
            <tbody>
              {capabilities.map((capability) => (
                <tr key={capability.name} className={capability.featured ? "featured-capability" : ""}>
                  <th scope="row">
                    <div className="capability-name">
                      <CapabilityIcon kind={capability.icon} />
                      <span>
                        <strong>{capability.name}{capability.featured && <em>TOP FOR CHAT + NLP</em>}</strong>
                        <small>{capability.description}</small>
                      </span>
                    </div>
                  </th>
                  {warehouseTypes.map((warehouse) => (
                    <td key={warehouse} className={`${capability.availability[warehouse] ? "available-cell" : "unavailable-cell"} ${capability.featured && capability.availability[warehouse] ? "genie-supported-cell" : ""}`}>
                      <Availability available={capability.availability[warehouse]} warehouse={warehouse} />
                      {capability.featured && capability.availability[warehouse] && <small className="capability-cell-note">Chat + NLP</small>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="guide-footnote">Capabilities and startup guidance are based on the Databricks SQL warehouse type documentation. Availability can vary by cloud and region.</p>
        <aside className="genie-callout" aria-labelledby="genie-callout-title">
          <div className="genie-callout-icon"><Spark /></div>
          <div>
            <p className="section-index">CHAT + NLP CAPABILITY</p>
            <h2 id="genie-callout-title">Choose Genie when users ask questions in natural language.</h2>
            <p>Genie turns chat-based questions about your data into natural-language analytics. It is available on Serverless and Pro only; Classic does not support Genie.</p>
          </div>
          <span className="genie-callout-badge">SERVERLESS + PRO</span>
        </aside>
      </section>

      <section className="guide-next-step">
        <div>
          <p className="section-index">READY TO PRICE A WORKLOAD?</p>
          <h2>Bring these capabilities into your decision.</h2>
        </div>
        <a className="guide-cta" href="/">Open Databricks workspace <span aria-hidden="true">↗</span></a>
      </section>

      <footer>
        <div><span className="brand-mark small"><span /></span><b>StrategyShifu</b></div>
        <p>Capability guide · validate availability for your cloud and region before committing.</p>
        <span>DECIDE WITH YOUR AGENT.</span>
      </footer>
    </main>
  );
}
