```
npm install
npm run dev
```

```
open http://localhost:3000
```

## Telegram AI bot

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and
`GOOGLE_GENERATIVE_AI_API_KEY` on the web service. The
secret must be 1–256 characters containing only letters, numbers, `_`, or `-`.
The bot accepts Telegram updates at `POST /telegram/webhook`, uses the AI SDK
with Google's `gemini-3.5-flash-lite` to generate a reply for incoming text or
media captions, and sends the reply to the same chat. Messages without text or
a caption are ignored. If AI generation fails, the bot sends a short fallback
message instead of silently leaving the chat unanswered.

After deploying, register the HTTPS endpoint with Telegram using `setWebhook`.
Run the following with the same token and secret available in your local shell;
the token is read from the environment rather than typed into a URL argument:

```sh
TELEGRAM_WEBHOOK_URL=https://personal-assistant-kq4j.onrender.com/telegram/webhook node --input-type=module <<'JS'
const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret, TELEGRAM_WEBHOOK_URL: url } = process.env
if (!token || !secret || !url) throw new Error('Missing Telegram configuration')
const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, secret_token: secret, allowed_updates: ['message'] })
})
const result = await response.json()
if (!response.ok || !result.ok) throw new Error(result.description ?? 'Could not set webhook')
console.log('Telegram webhook registered')
JS
```

The bot token and webhook secret must match the values configured on Render;
the Google API key must also be configured there for AI replies to work.

## Trigger.dev (development)

The `hello-world` background task is defined in `src/trigger/hello-world.ts`
for Trigger.dev project `proj_utbtedsfgmvhrluuxces`. Log in with
`npx trigger.dev@latest login`, then add the **Development** environment's
`TRIGGER_SECRET_KEY` to the ignored local `.env` file. Start the task worker
from the repository root with `npx trigger.dev@latest dev`. In the Trigger.dev
Development dashboard, open **Tasks → hello-world → Test**, supply
`{"name":"World"}` as the payload, and run the test. The task returns
`{"message":"Hello, World!"}`.

`npm run dev` loads the ignored `.env` into the local Hono process. If you run
the compiled app with `npm start` instead, export your variables first (or use
`node --env-file=.env dist/index.js`).

## Temporary public AI test

The `ai-test` Trigger.dev task uses the AI SDK with `gemini-3.5-flash-lite`
and a fixed prompt. With the Trigger.dev dev worker running and both
`TRIGGER_SECRET_KEY` (Development key) and `GOOGLE_GENERATIVE_AI_API_KEY` set
in the task environment, visit `GET /test/ai` to enqueue a run. The response
contains a `statusUrl` such as `/test/ai/run_...`; GET that URL to see its
status, then the generated `text` when complete. These routes are unauthenticated
and incur API charges on every run; remove them after testing. Do not use a
Development Trigger.dev key for a public production deployment: deploy the
task to Trigger.dev production and use a production key there first.
Render does not read your local `.env` file: configure its own production
`TRIGGER_SECRET_KEY` after deploying the task to Trigger.dev production.
