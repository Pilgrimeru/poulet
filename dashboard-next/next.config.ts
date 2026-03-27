import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["sequelize", "sqlite3"],
  async rewrites() {
    return [
      { source: "/attachments/:path*", destination: "/api/attachments/:path*" },
    ];
  },
};

export default config;
