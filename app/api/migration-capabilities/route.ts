import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SOURCES = {
  redshiftIceberg: "https://aws.amazon.com/about-aws/whats-new/2026/08/amazon-redshift-supports-apache-iceberg-v3/",
  databricksIceberg: "https://docs.databricks.com/aws/en/iceberg/",
  federation: "https://docs.databricks.com/aws/en/query-federation/database-federation",
  export: "https://docs.aws.amazon.com/redshift/latest/dg/r_UNLOAD.html",
} as const;

type CapabilityKind = keyof typeof SOURCES;

const SUPPORTED_SINCE: Partial<Record<CapabilityKind, string>> = {
  redshiftIceberg: "2026-08-31",
};

function stripMarkup(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function fallback(kind: CapabilityKind) {
  const common = { sourceUrl: SOURCES[kind], supportedSince: SUPPORTED_SINCE[kind] };
  if (kind === "redshiftIceberg") return {
    ...common,
    icebergVersionSupport: ["v3"],
    supportedOperations: ["READ", "WRITE"],
    unsupportedDataTypes: [],
    limitations: ["Validate table data types and features before migration.", "Define one catalog owner and explicit write ownership per table."],
  };
  if (kind === "databricksIceberg") return {
    ...common,
    icebergVersions: ["v1", "v2", "v3 (feature-dependent)"],
    foreignCatalogSupport: ["External Iceberg catalogs through Lakehouse Federation", "Unity Catalog Iceberg REST Catalog"],
    readSupport: true,
    writeSupport: "Managed Unity Catalog Iceberg supports writes; foreign Iceberg tables are read-only in Databricks.",
    limitations: ["Foreign Iceberg tables are read-only and have limited platform support.", "Confirm the runtime and client version required by each Iceberg feature."],
  };
  if (kind === "federation") return {
    ...common,
    supported: true,
    accessMode: "Unity Catalog foreign catalog over JDBC; Standard or Dedicated compute access modes.",
    readWriteSupport: "Read-only for Redshift federated queries.",
    recommendedUseCases: ["On-demand reporting", "Proofs of concept", "Exploration", "Incremental migration"],
    limitations: ["Large result sets can exhaust a single executor task.", "Redshift external data and case-sensitive identifiers are not supported."],
  };
  return {
    ...common,
    methods: [{ name: "UNLOAD → S3", supportsParquet: true, scalableForLargeData: true, description: "Parallel Redshift export to S3 in columnar Parquet format." }],
  };
}

async function retrieve(kind: CapabilityKind) {
  const response = await fetch(SOURCES[kind], {
    next: { revalidate: 86_400 },
    headers: { "user-agent": "StrategyShifu-Capability-Check/1.0" },
  });
  if (!response.ok) throw new Error(`Documentation request returned ${response.status}`);
  const text = stripMarkup(await response.text());

  if (kind === "redshiftIceberg") {
    return {
      sourceUrl: SOURCES[kind], supportedSince: SUPPORTED_SINCE[kind],
      icebergVersionSupport: text.includes("iceberg v3") ? ["v3"] : [],
      supportedOperations: text.includes("reading from") && text.includes("writing to") ? ["READ", "WRITE"] : [],
      unsupportedDataTypes: [],
      limitations: ["Validate table data types and features before migration.", "Define one catalog owner and explicit write ownership per table."],
    };
  }
  if (kind === "databricksIceberg") return {
    sourceUrl: SOURCES[kind], supportedSince: SUPPORTED_SINCE[kind],
    icebergVersions: ["v1", "v2", ...(text.includes("iceberg v3") ? ["v3 (feature-dependent)"] : [])],
    foreignCatalogSupport: ["External Iceberg catalogs through Lakehouse Federation", "Unity Catalog Iceberg REST Catalog"],
    readSupport: text.includes("read"),
    writeSupport: text.includes("foreign iceberg tables are read-only")
      ? "Managed Unity Catalog Iceberg supports writes; foreign Iceberg tables are read-only in Databricks."
      : "Write behavior varies by ownership and catalog; validate before implementation.",
    limitations: ["Foreign Iceberg tables are read-only and have limited platform support.", "Confirm the runtime and client version required by each Iceberg feature."],
  };
  if (kind === "federation") return {
    sourceUrl: SOURCES[kind], supportedSince: SUPPORTED_SINCE[kind],
    supported: text.includes("redshift"),
    accessMode: "Unity Catalog foreign catalog over JDBC; Standard or Dedicated compute access modes.",
    readWriteSupport: text.includes("queries are read-only") ? "Read-only for Redshift federated queries." : "Validate read/write behavior before implementation.",
    recommendedUseCases: ["On-demand reporting", "Proofs of concept", "Exploration", "Incremental migration"],
    limitations: ["Large result sets can exhaust a single executor task.", "Redshift external data and case-sensitive identifiers are not supported."],
  };
  return {
    sourceUrl: SOURCES[kind], supportedSince: SUPPORTED_SINCE[kind],
    methods: [{
      name: "UNLOAD → S3",
      supportsParquet: text.includes("parquet"),
      scalableForLargeData: text.includes("parallel"),
      description: "Parallel Redshift export to S3 in columnar Parquet format.",
    }],
  };
}

async function safeRetrieve(kind: CapabilityKind) {
  try {
    return await retrieve(kind);
  } catch {
    return fallback(kind);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "all";

  if (kind === "all") {
    const keys = Object.keys(SOURCES) as CapabilityKind[];
    const values = await Promise.all(keys.map((key) => safeRetrieve(key)));
    return NextResponse.json(Object.fromEntries(keys.map((key, index) => [key, values[index]])));
  }
  if (!(kind in SOURCES)) return NextResponse.json({ error: "Unknown capability kind." }, { status: 400 });
  return NextResponse.json(await safeRetrieve(kind as CapabilityKind));
}
