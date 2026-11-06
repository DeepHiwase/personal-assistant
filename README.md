```
npm install
npm run dev
```

```
open http://localhost:3000
```

## Telegram echo bot

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` on the web service. The
secret must be 1–256 characters containing only letters, numbers, `_`, or `-`.
The bot accepts Telegram updates at `POST /telegram/webhook` and copies each
incoming message back to its chat (including text and supported media).

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

Telegram's `copyMessage` does not support service messages, paid media,
giveaways, or invoices; these cannot be echoed by this bot.
