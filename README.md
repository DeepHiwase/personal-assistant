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
