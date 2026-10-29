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

  return timestamps.some((timestamp) => now - timestamp > CACHE_TTL_MS);
}

function readCache(cacheFilePath) {
  if (!fs.existsSync(cacheFilePath)) return [];
  const cachedProjects = JSON.parse(fs.readFileSync(cacheFilePath, "utf-8"));
  return Array.isArray(cachedProjects) ? cachedProjects : [];
}

function saveInCache(projects, cacheFilePath = "cache.json") {
  const cachedProjects = readCache(cacheFilePath);
  const now = Date.now();

  const activeProjects = cachedProjects.filter(
    (project) => !isExpired(project, now),
  );

  const newUniqueProjects = projects.filter(
    (newProject) =>
      !activeProjects.some(
        (cachedProject) =>
          cachedProject.title === newProject.title &&
          cachedProject.description === newProject.description,
      ),
  );

  const updatedProjects = [...activeProjects, ...newUniqueProjects];

  const removedExpired = activeProjects.length !== cachedProjects.length;
  if (newUniqueProjects.length > 0 || removedExpired) {
    fs.writeFileSync(
      cacheFilePath,
      JSON.stringify(updatedProjects, null, 2),
    );
  }
}

module.exports = {
  saveInCache,
  isExpired,
  CACHE_TTL_MS,
};
