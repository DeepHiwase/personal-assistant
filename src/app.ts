import { createHash, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'

type TelegramMessage = {
  chat?: { id?: number }
  message_id?: number
  message_thread_id?: number
  direct_messages_topic?: { topic_id?: number }
  from?: { is_bot?: boolean }
  text?: string
  caption?: string
}

type TelegramUpdate = { message?: TelegramMessage }

function matchesSecret(received: string | undefined, expected: string): boolean {
  const actualHash = createHash('sha256').update(received ?? '').digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(actualHash, expectedHash) && received !== undefined
}

export function createApp(generateReply: (prompt: string) => Promise<string> = async (prompt) => {
  const [{ google }, { generateText }] = await Promise.all([
    import('@ai-sdk/google'),
    import('ai')
  ])
  const { text } = await generateText({
    model: google('gemini-2.5-flash-lite'),
    prompt,
    maxOutputTokens: 512
  })
  return text
}) {
  const app = new Hono()

  app.get('/', (c) => {
    return c.text('Hello Render!')
  })

  app.get('/marco', (c) => {
    return c.text('polo')
  })

  app.post('/telegram/webhook', async (c) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    const token = process.env.TELEGRAM_BOT_TOKEN

    if (!secret || !token) {
      return c.text('Bot not configured', 503)
    }

    if (!matchesSecret(c.req.header('X-Telegram-Bot-Api-Secret-Token'), secret)) {
      return c.text('Unauthorized', 401)
    }

    let update: TelegramUpdate
    try {
      update = await c.req.json<TelegramUpdate>()
    } catch {
      return c.text('Invalid JSON', 400)
    }

    const message = update?.message
    if (!message) return c.text('OK')

    const chatId = message.chat?.id
    const messageId = message.message_id
    if (typeof chatId !== 'number' || !Number.isSafeInteger(chatId) ||
        typeof messageId !== 'number' || !Number.isSafeInteger(messageId) || messageId <= 0) {
      return c.text('Invalid message', 400)
    }

    if (message.from?.is_bot) return c.text('OK')

    const prompt = (typeof message.text === 'string' && message.text.trim()) ||
      (typeof message.caption === 'string' && message.caption.trim())
    if (!prompt) return c.text('OK')

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return c.text('AI not configured', 503)
    }

    let reply: string
    try {
      reply = await generateReply(prompt)
      if (!reply.trim()) return c.text('AI generation failed', 502)
    } catch {
      return c.text('AI generation failed', 502)
    }

    const payload = {
      chat_id: chatId,
      text: reply.slice(0, 4096),
      ...(message.message_thread_id !== undefined && { message_thread_id: message.message_thread_id }),
      ...(message.direct_messages_topic?.topic_id !== undefined && {
        direct_messages_topic_id: message.direct_messages_topic.topic_id
      })
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok || !(await response.json() as { ok?: boolean }).ok) {
        return c.text('Telegram delivery failed', 502)
      }
    } catch {
      return c.text('Telegram delivery failed', 502)
    }

    return c.text('OK')
  })

  return app
}

export default createApp()
