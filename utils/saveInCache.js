const fs = require("fs");

const CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

function toTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function isExpired(project, now = Date.now()) {
  const timestamps = [
    toTimestamp(project.scrapedAt),
    toTimestamp(project.postedAtTimestamp),
  ].filter((timestamp) => timestamp !== null);

  // Nothing to measure, so freshness cannot be proven: let it expire.
  if (timestamps.length === 0) return true;

  // Expired when ANY timestamp is older than the TTL, i.e. an entry is only
  // kept while both its scrape time and its posting time are inside the window.
  return timestamps.some((timestamp) => now - timestamp > CACHE_TTL_MS);
}

function isSameProject(a, b) {
  return a.title === b.title && a.description === b.description;
}

function readCache(cacheFilePath) {
  if (!fs.existsSync(cacheFilePath)) return [];

  const raw = fs.readFileSync(cacheFilePath, "utf-8").trim();
  if (!raw) return [];

  try {
    const cachedProjects = JSON.parse(raw);
    return Array.isArray(cachedProjects) ? cachedProjects : [];
  } catch (error) {
    console.error(`Failed to read cache ${cacheFilePath}:`, error.message);
    return [];
  }
}

function saveInCache(projects, cacheFilePath = "cache.json") {
  const cachedProjects = readCache(cacheFilePath);
  const now = Date.now();

  const activeProjects = cachedProjects.filter(
    (project) => !isExpired(project, now),
  );

  // Compare against every known project, not only the ones still inside the
  // TTL window: an old job that is still listed must not look brand new.
  const newUniqueProjects = projects.filter(
    (newProject) =>
      !cachedProjects.some((cachedProject) =>
        isSameProject(cachedProject, newProject),
      ),
  );

  // Expired jobs that are still on the page stay cached. Dropping them would
  // make the next run treat them as new again and resend them every tick.
  const stillListedProjects = cachedProjects.filter(
    (cachedProject) =>
      isExpired(cachedProject, now) &&
      projects.some((project) => isSameProject(cachedProject, project)),
  );

  const updatedProjects = [
    ...activeProjects,
    ...stillListedProjects,
    ...newUniqueProjects,
  ];

  const changed =
    newUniqueProjects.length > 0 ||
    updatedProjects.length !== cachedProjects.length;

  if (changed) {
    fs.writeFileSync(
      cacheFilePath,
      JSON.stringify(updatedProjects, null, 2),
    );
  }

  return newUniqueProjects;
}

module.exports = {
  saveInCache,
  isExpired,
  CACHE_TTL_MS,
};
