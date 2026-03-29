import { DB_PATH } from "@/lib/db";
import { initializeDatabase } from "@/lib/db/init";

async function main() {
  await initializeDatabase();
  console.log(`[dashboard] Database ready at ${DB_PATH}`);
}

main().catch((error) => {
  console.error("[dashboard] Failed to initialize database.", error);
  process.exit(1);
});
