import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './lib/auth.js'

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173"

const app = new Hono()

app.use(
  '*',
  cors({
		origin: frontendUrl,
		credentials: true,
	}),
)

app.on(["POST", "GET"], "/api/auth/*", (c) => {
	return auth.handler(c.req.raw);
});

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
