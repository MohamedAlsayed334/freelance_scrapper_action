const { main } = require("../index");

/**
 * Long-running scheduler for hosts without cron (Pterodactyl panels, PaaS).
 * Runs once immediately, then every SCRAPE_INTERVAL_MS (default 10 minutes).
 */
const INTERVAL_MS = Number(process.env.SCRAPE_INTERVAL_MS) || 10 * 60 * 1000;

function scheduleNext() {
  setTimeout(tick, INTERVAL_MS);
}

async function tick() {
  const startedAt = new Date().toISOString();
  console.log(`[scheduler] run started at ${startedAt}`);

  try {
    await main();
  } catch (error) {
    console.error(`[scheduler] run failed: ${error.message}`);
  }

  const nextAt = new Date(Date.now() + INTERVAL_MS).toISOString();
  console.log(`[scheduler] next run at ${nextAt}`);
  scheduleNext();
}

console.log(
  `[scheduler] started, interval ${Math.round(INTERVAL_MS / 60000)} minute(s)`,
);

tick();
