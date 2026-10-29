const { loadEnv } = require("./utils/env");
const nafezly = require("./platforms/nafezly");
const { sendNewProjects } = require("./utils/telegram");

loadEnv();

async function main() {
  const { newProjects } = await nafezly();
  console.log(`New projects: ${newProjects.length}`);

  const result = await sendNewProjects(newProjects);

  if (result.skipped > 0) {
    console.log(
      `Telegram skipped ${result.skipped} project(s): bot is not configured.`,
    );
  } else {
    console.log(`Telegram: ${result.sent} sent, ${result.failed} failed.`);
  }
}

main().catch((error) => {
  console.error("Scraping failed:", error.message);
  process.exitCode = 1;
});
