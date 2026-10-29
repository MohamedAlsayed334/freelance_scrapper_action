const { fetchWithTimeout } = require("./getpage");

const DEFAULT_API_URL = "https://api.telegram.org";
const MAX_TITLE_LENGTH = 400;
const MAX_DESCRIPTION_LENGTH = 600;
const MESSAGE_DELAY_MS = 1100;
const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 10000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    apiUrl: (process.env.TELEGRAM_API_URL || DEFAULT_API_URL).replace(
      /\/$/,
      "",
    ),
  };
}

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function safeStr(value) {
  return String(value ?? "").trim();
}

function truncate(str, max) {
  const s = safeStr(str);
  if (s.length <= max) return s;
  let cut = max - 1;
  // don't split a surrogate pair (emoji)
  if (cut > 0 && /[\uD800-\uDBFF]/.test(s[cut - 1])) cut -= 1;
  return s.slice(0, cut).trimEnd() + "…";
}

// Scraped descriptions contain the page's indentation/newlines.
function collapseWhitespace(value) {
  return safeStr(value).replace(/\s+/g, " ");
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function formatProject(project) {
  const title = escapeHtml(truncate(project.title, MAX_TITLE_LENGTH));
  const description = truncate(
    collapseWhitespace(project.description),
    MAX_DESCRIPTION_LENGTH,
  );
  const hasLink = Boolean(project.link && isHttpUrl(project.link));

  const lines = [`🆕 <b>New project</b>`, ``];

  // Make the title bold AND a hyperlink (blue & tappable)
  if (hasLink) {
    lines.push(`<a href="${escapeHtml(project.link)}"><b>${title}</b></a>`);
  } else {
    lines.push(`<b>${title}</b>`);
  }

  const meta = [];
  if (project.budget) meta.push(`💰 <b>${escapeHtml(project.budget)}</b>`);
  if (project.duration) meta.push(`⏱ ${escapeHtml(project.duration)}`);
  if (project.postedAt) meta.push(`🕒 ${escapeHtml(project.postedAt)}`);

  // One card: stats line, then the description
  if (meta.length || description) {
    const card = [];
    if (meta.length) card.push(meta.join(" · "));
    if (description) card.push(escapeHtml(description));

    lines.push(``, `<blockquote expandable>${card.join("\n\n")}</blockquote>`);
  }

  if (hasLink) {
    lines.push(
      ``,
      `🔗 <a href="${escapeHtml(project.link)}">Open on the site</a>`,
    );
  }

  return lines.join("\n");
}

async function sendMessage(text, config = getConfig(), attempt = 1) {
  const { token, chatId, apiUrl } = config;

  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  if (!chatId) throw new Error("TELEGRAM_CHAT_ID is not set");

  const response = await fetchWithTimeout(
    `${apiUrl}/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
    REQUEST_TIMEOUT_MS,
  );

  if (response.status === 429 && attempt < MAX_ATTEMPTS) {
    const payload = await response.json().catch(() => ({}));
    const retryAfter = payload.parameters?.retry_after ?? 1;
    await delay(retryAfter * 1000);
    return sendMessage(text, config, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Telegram sendMessage failed: HTTP ${response.status} ${body.slice(0, 300)}`,
    );
  }

  return response.json();
}

async function sendNewProjects(projects, config = getConfig()) {
  if (!projects.length) return { sent: 0, failed: 0, skipped: 0 };

  if (!config.token || !config.chatId) {
    console.warn(
      "Telegram is not configured; set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables",
    );
    return { sent: 0, failed: 0, skipped: projects.length };
  }

  let sent = 0;
  let failed = 0;

  for (const [index, project] of projects.entries()) {
    try {
      await sendMessage(formatProject(project), config);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to send "${project.title}": ${error.message}`);
    }

    if (index < projects.length - 1) await delay(MESSAGE_DELAY_MS);
  }

  return { sent, failed, skipped: 0 };
}

async function getUpdates(config = getConfig()) {
  const { token, apiUrl } = config;

  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const response = await fetchWithTimeout(
    `${apiUrl}/bot${token}/getUpdates`,
    {},
    REQUEST_TIMEOUT_MS,
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Telegram getUpdates failed: HTTP ${response.status} ${body.slice(0, 300)}`,
    );
  }

  const payload = await response.json();
  return payload.result || [];
}

module.exports = {
  formatProject,
  sendMessage,
  sendNewProjects,
  getUpdates,
  getConfig,
  MESSAGE_DELAY_MS,
};
