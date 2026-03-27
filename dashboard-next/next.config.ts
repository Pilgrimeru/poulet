import path from "path";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  serverExternalPackages: ["sequelize", "sqlite3"],
  async rewrites() {
    return [
      { source: "/attachments/:path*", destination: "/api/attachments/:path*" },
    ];
  },
};

export default config;
