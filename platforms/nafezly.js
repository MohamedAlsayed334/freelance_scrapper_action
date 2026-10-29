const cheerio = require("cheerio");
const { saveInCache } = require("../utils/saveInCache");
const { fetchWithRetries } = require("../utils/getpage");
const { parseRelativeTime } = require("../utils/parseRelativeTime");

const BASE_URLS = [
  "https://nafezly.com/projects?specialize=development&page=1",
];

function extractMeta(card, iconSelector) {
  const icon = card.find(iconSelector).first();
  return icon.length ? icon.parent().text().trim() : "";
}

function extractProjects(html, scrapedAt = Date.now()) {
  const $ = cheerio.load(html);
  const projects = [];

  $(".project-box").each((index, element) => {
    const card = $(element);
    const linkEl = card.find("a.text-truncate").first();
    const titleEl = card.find("h3").first();
    const title = linkEl.length
      ? linkEl.text().trim()
      : titleEl.length
        ? titleEl.text().trim()
        : "";

    const description = titleEl.length
      ? titleEl.text().trim()
      : card.find("h3").first().text().trim();
    const link = linkEl.length ? linkEl.attr("href") : "";
    const absoluteLink = link
      ? link.startsWith("http")
        ? link
        : `https://nafezly.com${link.startsWith("/") ? "" : "/"}${link}`
      : undefined;

    const budget = extractMeta(card, ".fa-usd-circle");
    const duration = extractMeta(card, ".fa-business-time");
    const postedAt = extractMeta(card, ".fa-clock");
    const postedAtTimestamp = parseRelativeTime(postedAt, scrapedAt);

    projects.push({
      title,
      description,
      budget,
      duration,
      postedAt,
      postedAtTimestamp,
      scrapedAt,
      link: absoluteLink,
    });
  });

  return projects;
}

async function fetchPage(url) {
  const html = await fetchWithRetries(url);
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
