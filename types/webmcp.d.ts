type WebMCPToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
};

type WebMCPTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => WebMCPToolResult | Promise<WebMCPToolResult>;
};

interface ModelContext {
  registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): void | Promise<void>;
}

interface Document {
  readonly modelContext?: ModelContext;
}
