const { fetchWithTimeout } = require("./getpage");

const DEFAULT_API_URL = "https://api.telegram.org";
const MAX_TITLE_LENGTH = 400;
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
    apiUrl: (process.env.TELEGRAM_API_URL || DEFAULT_API_URL).replace(/\/$/, ""),
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char],
  );
}

function formatProject(project) {
  const title =
    project.title.length > MAX_TITLE_LENGTH
      ? `${project.title.slice(0, MAX_TITLE_LENGTH - 1)}…`
      : project.title;

  const lines = [`🆕 <b>${escapeHtml(title)}</b>`];

  if (project.budget) lines.push(`💰 ${escapeHtml(project.budget)}`);
  if (project.duration) lines.push(`⏱ ${escapeHtml(project.duration)}`);
  if (project.postedAt) lines.push(`🕒 ${escapeHtml(project.postedAt)}`);
  if (project.link) lines.push(`🔗 ${escapeHtml(project.link)}`);

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
      "Telegram is not configured; set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env",
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
