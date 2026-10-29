const cheerio = require("cheerio");
const { saveInCache } = require("../utils/saveInCache");
const { fetchWithRetries } = require("../utils/getpage");

const BASE_URLS = [
  "https://nafezly.com/projects?specialize=development&page=1",
];

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
};

function extractProjects(html) {
  const $ = cheerio.load(html);
  const projects = [];

  $(".project-box").each((index, element) => {
    const card = $(element);
    const linkEl = card.find("a.text-truncate").first();
    const titleEl = card.find("h3").first();
    const budgetEl = card.find(".fa-usd-circle").first();
    const title = linkEl.length
      ? linkEl.text().trim()
      : titleEl.length
        ? titleEl.text().trim()
        : "";

    const description = titleEl.length
      ? titleEl.text().trim()
      : card.find("h3").first().text().trim();
    const budget = budgetEl.length ? budgetEl.text().trim() : "";
    const link = linkEl.length ? linkEl.attr("href") : "";

    projects.push({
      title,
      description,
      budget,
      link: link ? `https://nafezly.com${link}` : undefined,
    });
  });

  return projects;
}

async function fetchPage(url) {
  const html = await fetchWithRetries(url, { headers: REQUEST_HEADERS });
  const text = await html.text();
  return extractProjects(text);
}

async function nafezly() {
  let projectData;
  try {
    projectData = await fetchPage(BASE_URLS[0]);
  } catch (error) {
    console.error("Failed to fetch projects:", error.message);
    projectData = [];
  }

  saveInCache(projectData);

  return projectData;
}

module.exports = nafezly;
