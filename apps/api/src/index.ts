import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './lib/auth.js'
import { debtorsRouter } from './routes/debtors.js'
import { orgsRouter } from './routes/orgs.js'

const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
/** Comma-separated extra origins (e.g. Vite preview port). First is still FRONTEND_URL. */
const extraOrigins = (process.env.CORS_EXTRA_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const allowedOrigins = [...new Set([frontendUrl, ...extraOrigins])]

const app = new Hono()

app.use(
  '*',
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
)

app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

app.route('/api/debtors', debtorsRouter)
app.route('/api/orgs', orgsRouter)

app.get('/hello', (c) => {
  return c.json({
    message: 'Hello from API',
    timestamp: new Date().toISOString(),
  })
})

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
