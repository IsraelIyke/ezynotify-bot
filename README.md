
<!-- PROJECT LOGO -->
<p align="center">
  <a href="https://github.com/IsraelIyke/ezynotify-bot">
    <img src="assets/ezynotify_demo.gif" alt="ezynotify demo" width="220"/>
  </a>
  <h1 align="center">EzyNotify — Telegram Monitor Bot</h1>
  <p align="center">
    <em>Monitor websites and keywords, get Telegram notifications — effortless, reliable, and lightweight. [Live Project](https://t.me/ezynotify_bot)</em>
  </p>
</p>

<p align="center">
  <a href="#features"><img alt="features" src="https://img.shields.io/badge/feature-monitoring-green.svg"/></a>
  <a href="#quick-start"><img alt="quickstart" src="https://img.shields.io/badge/quick-start-setup-blue.svg"/></a>
  <a href="#deployment"><img alt="deploy" src="https://img.shields.io/badge/deploy-vercel%20%7C%20railway-orange.svg"/></a>
  <a href="https://github.com/IsraelIyke/ezynotify-bot/stargazers"><img alt="stars" src="https://img.shields.io/github/stars/IsraelIyke/ezynotify-bot.svg?style=social&label=Star"/></a>
</p>

---

## ✨ What is EzyNotify?

EzyNotify is a free Telegram bot built in two parts; Vercel Serverless Webhook with Node.js and the bot itself with python (hosted in another repo for github actions. [Check here](https://github.com/IsraelIyke/ezynotifyv2)) that lets users set up **two** types of monitors:

- **Update Monitor** — Track an entire page for content changes and receive summaries.
- **Keyword Check** — Watch for specific keywords on a webpage and get alerted when they appear/disappear.

It uses **Supabase** for storage and the Telegram API (webhook style) for interactions. Built to be simple to deploy (Vercel) and easy to extend.

---

## 🚀 Features

- Add / edit / delete monitoring requests via Telegram commands.
- Persist requests and state in Supabase (`ezynotify` table).
- Multi-step conversational flows for creating and editing monitors.
- Rich, user-friendly Telegram messages and instructions.
- Lightweight — single API route handles incoming Telegram updates.

---

## 🧭 Commands (what users type in Telegram)

```
/new_update_monitor      - Start a new site update monitor (multi-step)
/new_keyword_check      - Start monitoring a keyword on a site (multi-step)
/list_update_requests   - List your update monitors
/list_keyword_requests  - List your keyword monitors
/editupdate<id>         - Edit an update monitor (sent as a private command link)
//deleteupdate<id>      - Delete an update monitor
/editkeyword<id>        - Edit a keyword monitor
/deletekeyword<id>      - Delete a keyword monitor
/help                   - Show help and available commands
```

> The bot replies with user-friendly prompts and validates inputs (e.g., URLs, yes/no answers).

---

## 📁 Project Structure (extracted)

```
ezynotify-bot/
├─ api/
│  └─ telegram.js          # Main webhook handler that processes Telegram updates
├─ package.json
├─ package-lock.json
└─ README.md (this file)
```

---

## ⚙️ Quick Start (Local / Vercel)

### Requirements
- Node.js (v16+ recommended)
- A Supabase project (for DB)
- Telegram bot token and webhook URL (you will set webhook to your deployed endpoint)

### Environment variables

Create a `.env` (or configure via platform UI) with:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_key
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
WEBHOOK_SECRET=optional_secret_string
```

> `SUPABASE_KEY` should be a **service_role** or API key with read/write access to the `ezynotify` table depending on how you use row-level security.

### Run locally (for testing)
EzyNotify's handler is meant to be deployed as a serverless function (Vercel/Netlify). To test locally:

1. Install deps
```bash
npm install
```

2. Start a small local server that forwards Telegram updates to the handler (example using `vercel dev` or simple express wrapper). For a quick test, use `vercel dev` in the project root if using Vercel.

> Note: Telegram requires a public HTTPS webhook. Use `ngrok` to expose local server during development:
```bash
npx ngrok http 3000
# set webhook to https://<your-ngrok>.ngrok.io/api/telegram
```

---

## 📦 Deploy (Vercel example)

1. Push the repo to GitHub.
2. Go to Vercel → New Project → Import GitHub repo.
3. Set Environment Variables in Vercel dashboard (same as `.env` above).
4. Configure the Serverless Function path (usually `/api/telegram`).
5. Deploy and note the production URL.
6. Set Telegram webhook (replace tokens & URL):

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://your-deployment.vercel.app/api/telegram"
```

If successful, Telegram will start sending updates to your endpoint.

---

## 🔒 Security & Best Practices

- Never commit `SUPABASE_KEY` or `TELEGRAM_BOT_TOKEN` to source control.
- Prefer to use Supabase Row Level Security and service_role keys carefully.
- Validate and sanitize user-provided URLs before fetching.
- Rate-limit requests and respect remote sites (consider `robots.txt` and scraping rules).

---

## 🧩 How it works (high level)

1. Telegram sends updates to `/api/telegram` (webhook).
2. Handler reads `message.text` and `message.chat.id` and runs command matching.
3. For multi-step flows, user session state is kept in memory (`userState` Map) until completed.
4. Completed requests are stored in `ezynotify` table in Supabase.
5. Background checker (not included here. [see here](https://github.com/IsraelIyke/ezynotifyv2) ) would read `ezynotify` rows and perform periodic checks, sending messages with `sendMessage` to users.

---

## ✍️ Example: Creating an Update Monitor (user flow)

1. `/new_update_monitor`
2. Bot: "Enter the URL you want to monitor"
3. User: `https://example.com/news`
4. Bot: "Send `yes` to receive detailed diffs or `no` for short alerts"
5. User: `yes`
6. Bot: "Continue check after first result"
7. User: `yes` or `no`
8. Bot: "✅ Update monitoring request created!"

---

## 🛠️ Extending the project

- Add a background worker (Cloud Function, Cron job, or Worker) that polls Supabase rows and performs change detection.
- Add webhook verification using `WEBHOOK_SECRET` to validate Telegram calls.
- Implement richer diffs (use `diff` libs) and screenshot attachments for visual change detection.
- Add analytics: count alerts sent per user, success/failure rates.

---

## ✅ Contribution

Contributions are welcome! Open an issue or a PR. Suggested workflow:

1. Fork the repo
2. Create a branch `feature/your-feature`
3. Add tests & update README
4. Open a Pull Request

---

## ❤️ Credits & License

Built with ❤️ and zero ☕. Ai helped a lot 😉.  
This project is licensed under the **MIT License** — see `LICENSE` for details.

---

## 📬 Contact

If you want help deploying or customizing the bot, open an issue.

---

<p align="center">
  <sub>Made with ❤️ by IsraelIyke</sub>
</p>
