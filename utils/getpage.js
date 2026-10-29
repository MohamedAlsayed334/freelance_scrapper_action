const MAX_RETRIES = 3;
const TIMEOUT_MS = 10000;
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
};

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetries(url, options = {}, retries = MAX_RETRIES, timeoutMs = TIMEOUT_MS) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);

      if (!res.ok) {
        const body = await res.text();
        lastError = new Error(
          `HTTP ${res.status} for ${url}. Response: ${body.slice(0, 500)}`
        );
        throw lastError;
      }

      return res;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        console.log(`Retry ${attempt}/${retries} for ${url}...`);
      }
    }
  }

  throw new Error(
    `Failed to fetch ${url} after ${retries} attempts: ${lastError.message}`
  );
}

async function getPage(url) {
  const response = await fetchWithRetries(url, { headers: REQUEST_HEADERS });
  const html = await response.text();
  return html;
}

module.exports = {
  getPage,
  fetchWithTimeout,
  fetchWithRetries,
};

