import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from './app.js'

test('Telegram webhook generates and sends an AI reply to text and captions', async (t) => {
  const previous = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY
  }
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret'
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key'

  const prompts: string[] = []
  let generationFails = false
  const app = createApp(async (prompt) => {
    prompts.push(prompt)
    if (generationFails) throw new Error('Google API failed')
    return `AI reply to: ${prompt}`
  })
  const calls: { url: string; body: Record<string, unknown> }[] = []
  let telegramOk = true
  const errors: unknown[][] = []
  t.mock.method(console, 'error', (...args: unknown[]) => { errors.push(args) })
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ ok: telegramOk }), { status: telegramOk ? 200 : 400 })
  })

  const request = (body: unknown, secret = 'test-webhook-secret') => app.request('/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify(body)
  })

  try {
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 5, text: ' hello ' } })).status, 200)
    assert.deepEqual(prompts, ['hello'])
    assert.deepEqual(calls[0], {
      url: 'https://api.telegram.org/bottest-bot-token/sendMessage',
      body: { chat_id: 123, text: 'AI reply to: hello' }
    })

    assert.equal((await request({ message: {
      chat: { id: -123 }, message_id: 6, caption: 'picture question', message_thread_id: 4,
      direct_messages_topic: { topic_id: 7 }
    } })).status, 200)
    assert.deepEqual(prompts, ['hello', 'picture question'])
    assert.deepEqual(calls[1]?.body, {
      chat_id: -123, text: 'AI reply to: picture question', message_thread_id: 4, direct_messages_topic_id: 7
    })

    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 7, text: 'no' } }, 'wrong')).status, 401)
    assert.equal((await app.request('/telegram/webhook', { method: 'POST' })).status, 401)
    assert.equal((await request({ edited_message: { chat: { id: 123 }, message_id: 5 } })).status, 200)
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 8, text: 'hi', from: { is_bot: true } } })).status, 200)
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 9, photo: [{}] } })).status, 200)
    assert.equal((await request({ message: { chat: { id: 123 } } })).status, 400)
    assert.equal((await app.request('/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret' },
      body: '{'
    })).status, 400)
    assert.equal(prompts.length, 2)
    assert.equal(calls.length, 2)

    generationFails = true
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 10, text: 'hi' } })).status, 200)
    assert.deepEqual(calls[2]?.body, {
      chat_id: 123, text: 'Sorry, I could not generate a reply right now. Please try again later.'
    })
    assert.equal(errors[0]?.[0], 'AI generation failed')
    assert.equal(JSON.stringify(errors).includes('Google API failed'), false)
    generationFails = false

    telegramOk = false
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 11, text: 'hi' } })).status, 502)

    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 12, text: 'hi' } })).status, 503)
    delete process.env.TELEGRAM_WEBHOOK_SECRET
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 13, text: 'hi' } })).status, 503)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
