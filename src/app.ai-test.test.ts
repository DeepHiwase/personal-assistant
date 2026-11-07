import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from './app.js'

test('public AI test enqueues a task and reads its generated response', async () => {
  const previousKey = process.env.TRIGGER_SECRET_KEY
  process.env.TRIGGER_SECRET_KEY = 'tr_dev_sk_test'
  let triggers = 0
  let status = 'QUEUED'
  let taskIdentifier = 'ai-test'
  let retrievalFails = false
  const app = createApp(async () => 'unused', {
    trigger: async () => {
      triggers++
      return 'run_test1234'
    },
    retrieve: async () => {
      if (retrievalFails) throw new Error('Trigger.dev unavailable')
      return {
        taskIdentifier,
        status,
        isCompleted: status !== 'QUEUED',
        output: status === 'COMPLETED' ? { text: 'Hello from AI!' } : undefined
      }
    }
  })

  try {
    const started = await app.request('/test/ai')
    assert.equal(started.status, 202)
    assert.equal(started.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual(await started.json(), { runId: 'run_test1234', statusUrl: '/test/ai/run_test1234' })
    assert.equal(triggers, 1)

    const queued = await app.request('/test/ai/run_test1234')
    assert.equal(queued.status, 202)
    assert.deepEqual(await queued.json(), { status: 'QUEUED' })

    status = 'COMPLETED'
    const completed = await app.request('/test/ai/run_test1234')
    assert.equal(completed.status, 200)
    assert.deepEqual(await completed.json(), { status: 'COMPLETED', text: 'Hello from AI!' })

    status = 'FAILED'
    assert.equal((await app.request('/test/ai/run_test1234')).status, 502)
    taskIdentifier = 'another-task'
    assert.equal((await app.request('/test/ai/run_test1234')).status, 404)
    assert.equal((await app.request('/test/ai/invalid')).status, 400)
    retrievalFails = true
    assert.equal((await app.request('/test/ai/run_test1234')).status, 502)

    delete process.env.TRIGGER_SECRET_KEY
    const missingKey = await app.request('/test/ai')
    assert.equal(missingKey.status, 503)
    assert.deepEqual(await missingKey.json(), { error: 'TRIGGER_SECRET_KEY missing from server environment' })
  } finally {
    if (previousKey === undefined) delete process.env.TRIGGER_SECRET_KEY
    else process.env.TRIGGER_SECRET_KEY = previousKey
  }
})
