import { config } from "dotenv";
config();

import { db } from "@/lib/db";
import { refreshAllPostMetrics } from "@/lib/forum/post-metrics";

async function main() {
  const startedAt = Date.now();
  await refreshAllPostMetrics();
  const elapsedMs = Date.now() - startedAt;
  console.log(`Post metrics refreshed in ${elapsedMs}ms.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
