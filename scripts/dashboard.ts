import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";

const root = resolve(__dirname, "..");
const dashboardRoot = resolve(root, "dashboard-next");
const databasePath = resolve(root, "database", "database.sqlite");
const attachmentsPath = resolve(root, "database", "attachments");

dotenvConfig({ path: resolve(root, "config.env"), quiet: true });

function sharedEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_PATH: process.env.DATABASE_PATH ?? databasePath,
    ATTACHMENTS_PATH: process.env.ATTACHMENTS_PATH ?? attachmentsPath,
  };
}

function ensureDashboardDeps() {
  const nextBin = resolve(dashboardRoot, "node_modules", ".bin", "next");
  const nextPkg = resolve(dashboardRoot, "node_modules", "next", "package.json");

  if (existsSync(nextBin) || existsSync(nextPkg)) {
    initializeDashboardDb();
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
    initializeDashboardDb();
  });
}

function initializeDashboardDb() {
  console.log("[dashboard] Initializing SQLite database...");

  const init = spawn("bun", ["run", "./scripts/init-db.ts"], {
    cwd: dashboardRoot,
    stdio: "inherit",
    shell: true,
    env: sharedEnv(),
  });

  init.on("close", (code) => {
    if (code !== 0) {
      console.error("[dashboard] Database initialization failed.");
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
    env: sharedEnv(),
  });

  const dashboard = spawn("bun", ["run", "dev"], {
    cwd: dashboardRoot,
    stdio: "inherit",
    shell: true,
    env: sharedEnv(),
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
