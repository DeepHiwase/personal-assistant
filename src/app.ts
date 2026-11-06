import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Render!')
})

app.get('/marco', (c) => {
  return c.text('polo')
})

export default app
