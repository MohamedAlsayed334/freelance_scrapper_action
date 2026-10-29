const fs = require("fs");

function compareProjects(newProjects, cacheFilePath) {
  let cachedProjects = [];
  if (fs.existsSync(cacheFilePath)) {
    const cacheData = fs.readFileSync(cacheFilePath, "utf-8");
    cachedProjects = JSON.parse(cacheData);
  }

  const newUniqueProjects = newProjects.filter(
    (newProject) =>
      !cachedProjects.some(
        (cachedProject) =>
          cachedProject.title === newProject.title &&
          cachedProject.description === newProject.description,
      ),
  );

  if (newUniqueProjects.length > 0) {
    cachedProjects.push(...newUniqueProjects);
    fs.writeFileSync(cacheFilePath, JSON.stringify(cachedProjects, null, 2));
  }
}
function saveInCache(projects) {
  const cacheFilePath = "cache.json";
  return compareProjects(projects, cacheFilePath);
}

module.exports = {
  saveInCache,
};
