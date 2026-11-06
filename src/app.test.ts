import assert from 'node:assert/strict'
import { test } from 'node:test'
import app from './app.js'

test('Telegram webhook authenticates and copies incoming messages', async (t) => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN
  const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret'

  const calls: { url: string; body: Record<string, unknown> }[] = []
  let telegramOk = true
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
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 5, text: 'hello' } })).status, 200)
    assert.deepEqual(calls[0], {
      url: 'https://api.telegram.org/bottest-bot-token/copyMessage',
      body: { chat_id: 123, from_chat_id: 123, message_id: 5 }
    })

    assert.equal((await request({ message: {
      chat: { id: -123 }, message_id: 6, photo: [{ file_id: 'photo' }], message_thread_id: 4
    } })).status, 200)
    assert.deepEqual(calls[1]?.body, {
      chat_id: -123, from_chat_id: -123, message_id: 6, message_thread_id: 4
    })

    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 7 } }, 'wrong')).status, 401)
    assert.equal((await app.request('/telegram/webhook', { method: 'POST' })).status, 401)
    assert.equal((await request({ edited_message: { chat: { id: 123 }, message_id: 5 } })).status, 200)
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 8, from: { is_bot: true } } })).status, 200)
    assert.equal((await request({ message: { chat: { id: 123 } } })).status, 400)
    assert.equal((await app.request('/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret' },
      body: '{'
    })).status, 400)
    assert.equal(calls.length, 2)

    telegramOk = false
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 5 } })).status, 502)

    delete process.env.TELEGRAM_WEBHOOK_SECRET
    assert.equal((await request({ message: { chat: { id: 123 }, message_id: 5 } })).status, 503)
  } finally {
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
    else process.env.TELEGRAM_BOT_TOKEN = previousToken
    if (previousSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET
    else process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret
  }
})
