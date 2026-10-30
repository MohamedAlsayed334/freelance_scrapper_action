# Freelance Scraper — nafezly → Telegram

Scrapes the project feed on [nafezly.com](https://nafezly.com) and sends every **new** project to Telegram: title, description, budget, duration, posting time, and a direct link.

Runs on a small always-on host (Botkeep free tier) and checks for new projects every 10 minutes.

```
fetch page → parse cards → dedupe against cache.json → send new jobs to Telegram
```

---

## How it works

| Step | File | What happens |
| --- | --- | --- |
| Fetch | `utils/getpage.js` | `fetch` with a Chrome User-Agent, 10s timeout, 3 retries. Non-2xx responses throw. |
| Parse | `platforms/nafezly.js` | cheerio reads every `.project-box` and extracts title, description, budget, duration, posted text, absolute link. |
| Dedupe | `utils/saveInCache.js` | Compares against **every** cached job by title + description, drops entries older than **2 days**, returns only genuinely new projects. Expired jobs that are still listed stay cached until they leave the page, so a bumped old job is never re-sent. |
| Notify | `utils/telegram.js` | Sends one HTML message per job (blockquote formatting, escaped values, retry on rate limits). |
| Orchestrate | `index.js` | Runs the four steps above. `npm run start:once` = one pass. |
| Schedule | `scripts/scheduler.js` | Runs `index.js` immediately, then every `SCRAPE_INTERVAL_MS` (default 10 minutes) without overlapping runs. |

`cache.json` is committed to the repo so the state survives a redeploy. It is safe to delete — the next run simply treats everything on the page as new.

---

## Requirements

- **Node.js 18+** (uses global `fetch`)
- A Telegram bot token and your chat ID (see [Telegram setup](#telegram-setup))

---

## Telegram setup

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token (`123456:ABC...`).
2. Send any message to your new bot.
3. Open this URL and read the `chat.id` value:

   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```

4. Put both values in `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

For a group, add the bot to the group first; the group ID is usually negative (`-100...`).

---

## Run locally

```bash
cp .env.example .env      # then fill in the two values
npm ci
npm start                 # long-running loop, every 10 minutes
npm run start:once        # a single scrape, then exit
```

`.env` is loaded by `utils/env.js` and is gitignored. Real environment variables always win over `.env`, so the same code works in CI and on a host panel.

---

## Host on Botkeep (recommended)

Botkeep is a small PaaS: it keeps one process alive 24/7, which is exactly what this project needs. There is **no cron** there — `scripts/scheduler.js` does the scheduling in-process.

### 1. Create the server

1. Sign in at <https://botkeep.cloud> → **Start free** (no card required).
2. Create a new server and pick the **Node.js** runtime profile.
   - Free plan: 1 server, 512 MB RAM, 0.5 vCPU, 1 GB storage — plenty here.
3. Choose the source:
   - **GitHub** (recommended): connect the account and pick this repository, branch `main`.
   - **ZIP**: build one without dependencies:
     ```bash
     zip -r ../scraper.zip . -x 'node_modules/*' '.git/*' '.env' 'pageex.html'
     ```

### 2. Configure it

| Setting | Value |
| --- | --- |
| **Start command** | `npm start` |
| `TELEGRAM_BOT_TOKEN` | your bot token |
| `TELEGRAM_CHAT_ID` | your chat ID |
| `SCRAPE_INTERVAL_MS` *(optional)* | `600000` (default: 10 minutes) |

Keep `npm start` — it launches the scheduler, not a one-shot script. Dependencies are installed automatically from `package-lock.json`.

> Do **not** upload `.env` or paste tokens into the repo. Use the panel's environment/secret fields.

### 3. Start and verify

Press **Start**, then open the console. A healthy start looks like this:

```
[scheduler] started, interval 10 minute(s)
[scheduler] run started at 2026-10-30T00:12:25.682Z
Scraped 20 projects
New projects: 0
Telegram: 0 sent, 0 failed.
[scheduler] next run at 2026-10-30T00:22:25.682Z
```

What each line means:

- `Scraped N projects` — the page was fetched and parsed. `N` should be around 20.
- `New projects: 0` — nothing unseen since the last run. This is normal.
- `Telegram: X sent` — only when something new appeared.
- `[scheduler] next run at ...` — the process stays alive and will tick again.

A crash-restart loop (the panel repeatedly reporting "server process in a crashed state") means the start command is running a one-shot script. Use `npm start`.

### 4. Update the deployment

```bash
git add .
git commit -m "feat: ..."
git push
```

Then redeploy/re-pull from the panel and restart. Files such as `cache.json` live on the server disk, but a redeploy refreshes tracked files from the repo — the committed `cache.json` is a reasonable starting point either way.

---

## Alternative hosts

**VPS with cron** (also works, one run per tick):

```bash
git clone <repo> && cd freelance_scrapper
npm ci
printf 'TELEGRAM_BOT_TOKEN=...\nTELEGRAM_CHAT_ID=...\n' > .env
crontab -e
```

```cron
*/10 * * * * cd /path/to/freelance_scrapper && /usr/bin/node index.js >> scraper.log 2>&1
```

Use `index.js` here, not `npm start`, so cron gets a short-lived process instead of a permanent loop.

**GitHub Actions** — not usable for this target. Cloudflare answers GitHub-hosted runners with `403 Just a moment...` because they run on shared datacenter IPs, and GitHub's `schedule` is best-effort (runs are delayed or dropped). The workflow in `.github/workflows/main.yaml` is kept for reference with its schedule commented out. It would only work on a **self-hosted runner** (`runs-on: self-hosted`), which executes from your own IP.

---

## Troubleshooting

| Console output | Meaning | Fix |
| --- | --- | --- |
| `Failed to fetch ... HTTP 403 ... Just a moment...` | Cloudflare challenged the host's IP | Move to a different host/IP, or use a proxy. Retrying or changing headers will not help. |
| `Scraped 0 projects` | Page loaded but no cards matched | nafezly changed their markup, or you got a challenge page with status 200. Check `.project-box` in the HTML. |
| `Telegram skipped N project(s): bot is not configured` | `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` missing | Set them as real env vars on the host. |
| Process exits right after the run | Start command is a one-shot script | Use `npm start` (`scripts/scheduler.js`). |
| Old jobs arrive again | `cache.json` was deleted or reset | Nothing is broken; the run rebuilds the cache. Keep the file on a persistent disk. |
| No Telegram message for hours | No new projects, or the token is wrong | Check for `Telegram: 0 sent, 0 failed.` vs `failed`. |

---

## Project structure

```
index.js                 scrape → notify orchestration (exports main)
scripts/scheduler.js     in-process loop for hosts without cron
platforms/nafezly.js     fetch + parse the project feed
utils/getpage.js         fetch helper (timeout + retries + User-Agent)
utils/parseRelativeTime.js  "قبل ساعتين" → timestamp
utils/saveInCache.js     dedupe + 2-day TTL
utils/telegram.js        message formatting and delivery
utils/env.js             minimal .env loader (real env wins)
cache.json               seen jobs (committed, 2-day window)
.github/workflows/main.yaml  disabled reference workflow
```

---

## License

MIT
