import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The CLI checker in Next 16.3 currently misreads otherwise valid
  // TypeScript 5.9 --showConfig output in this environment.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
