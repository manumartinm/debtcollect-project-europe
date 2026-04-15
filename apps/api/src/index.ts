import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const frontendUrl = process.env.FRONTEND_URL

const app = new Hono()

app.use(
  '*',
  cors({
    origin: frontendUrl ?? '*',
  })
)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/hello', (c) => {
  return c.json({
    message: 'Hello from API',
    timestamp: new Date().toISOString(),
  })
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
