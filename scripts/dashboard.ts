import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "..");
const dashboardRoot = resolve(root, "dashboard-next");

function ensureDashboardDeps() {
  const nextBin = resolve(dashboardRoot, "node_modules", ".bin", "next");
  const nextPkg = resolve(dashboardRoot, "node_modules", "next", "package.json");

  if (existsSync(nextBin) || existsSync(nextPkg)) {
    startProcesses();
    return;
  }

  console.log("[dashboard] Installing dashboard-next dependencies...");

  const install = spawn("bun", ["install"], {
    cwd: dashboardRoot,
    stdio: "inherit",
    shell: true,
  });

  install.on("close", (code) => {
    if (code !== 0) {
      console.error("[dashboard] Failed to install dependencies.");
      process.exit(code ?? 1);
    }
    startProcesses();
  });
}

function startProcesses() {
  const bot = spawn("bun", ["run", "./src/index.ts"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  const dashboard = spawn("bun", ["run", "dev", "--turbopack"], {
    cwd: dashboardRoot,
    stdio: "inherit",
    shell: true,
  });

  function cleanup() {
    bot.kill();
    dashboard.kill();
    process.exit();
  }

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
ensureDashboardDeps();
