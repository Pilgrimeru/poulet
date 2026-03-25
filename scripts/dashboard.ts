import { spawn } from "child_process";
import { resolve } from "path";

const root = resolve(__dirname, "..");

const api = spawn("bun", ["run", "dev"], {
  cwd: resolve(root, "dashboard-api"),
  stdio: "inherit",
  shell: true,
});

const ui = spawn("bun", ["run", "dev"], {
  cwd: resolve(root, "dashboard"),
  stdio: "inherit",
  shell: true,
});

process.on("SIGINT", () => {
  api.kill();
  ui.kill();
  process.exit();
});
