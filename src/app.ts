import { createHash, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import type { aiTestTask } from './trigger/ai-test.js'

type AiTestRun = {
  taskIdentifier: string
  status: string
  isCompleted: boolean
  output?: { text: string }
}

type AiTestClient = {
  trigger: () => Promise<string>
  retrieve: (runId: string) => Promise<AiTestRun>
}

const aiTestClient: AiTestClient = {
  trigger: async () => {
    const { tasks } = await import('@trigger.dev/sdk')
    const handle = await tasks.trigger<typeof aiTestTask>('ai-test', undefined)
    return handle.id
  },
  retrieve: async (runId) => {
    const { runs } = await import('@trigger.dev/sdk')
    const run = await runs.retrieve<typeof aiTestTask>(runId)
    return {
      taskIdentifier: run.taskIdentifier,
      status: run.status,
      isCompleted: run.isCompleted,
      output: run.output
    }
  }
}

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
    model: google('gemini-3.5-flash-lite'),
    prompt,
    maxOutputTokens: 512
  })
  return text
}, testClient: AiTestClient = aiTestClient) {
  const app = new Hono()

  app.get('/', (c) => {
    return c.text('Hello Render!')
  })

  app.get('/marco', (c) => {
    return c.text('polo')
  })

  // Temporary public smoke test. Keep the prompt fixed to avoid accepting arbitrary AI workloads.
  app.get('/test/ai', async (c) => {
    c.header('Cache-Control', 'no-store')
    if (!process.env.TRIGGER_SECRET_KEY) return c.json({ error: 'TRIGGER_SECRET_KEY missing from server environment' }, 503)

    try {
      const runId = await testClient.trigger()
      return c.json({ runId, statusUrl: `/test/ai/${runId}` }, 202)
    } catch {
      return c.json({ error: 'Could not start AI test' }, 502)
    }
  })

  app.get('/test/ai/:runId', async (c) => {
    c.header('Cache-Control', 'no-store')
    if (!process.env.TRIGGER_SECRET_KEY) return c.json({ error: 'TRIGGER_SECRET_KEY missing from server environment' }, 503)

    const runId = c.req.param('runId')
    if (!/^run_[A-Za-z0-9_-]{4,128}$/.test(runId)) return c.json({ error: 'Invalid run ID' }, 400)

    try {
      const run = await testClient.retrieve(runId)
      if (run.taskIdentifier !== 'ai-test') return c.json({ error: 'Run not found' }, 404)
      if (!run.isCompleted) return c.json({ status: run.status }, 202)
      if (!run.output?.text) return c.json({ status: run.status, error: 'AI test failed' }, 502)
      return c.json({ status: run.status, text: run.output.text })
    } catch {
      return c.json({ error: 'Could not retrieve AI test' }, 502)
    }
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

    let reply = 'Sorry, I could not generate a reply right now. Please try again later.'
    try {
      const generated = await generateReply(prompt)
      if (generated.trim()) reply = generated
      else console.error('AI generation returned an empty reply')
    } catch (error) {
      // Do not log prompts, credentials, or raw provider error messages.
      console.error('AI generation failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        statusCode: typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined
      })
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
