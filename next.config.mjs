import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
const nextConfig = (phase) => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@node-rs/jieba"],
  },
});

export default nextConfig;
