import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Scalar } from '@scalar/hono-api-reference'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './lib/auth.js'
import { openApiSpec } from './openapi.js'
import { debtorsRouter } from './routes/debtors.js'
import { orgsRouter } from './routes/orgs.js'
import { tokenRoutes } from './routes/token.js'
import { transcriptsRouter } from './routes/transcripts.js'

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

app.get('/api/openapi.json', (c) => c.json(openApiSpec))

app.get(
  '/api/docs',
  Scalar({
    pageTitle: 'Debt Collect API',
    theme: 'default',
    content: openApiSpec,
  }),
)

app.route('/api/debtors', debtorsRouter)
app.route('/api/orgs', orgsRouter)
app.route('/api/token', tokenRoutes)
app.route('/api/transcripts', transcriptsRouter)

app.get('/health', (c) => {
  return c.json({
    ok: true,
    apifyConfigured: Boolean(process.env.APIFY_TOKEN ?? process.env.APIFY_API_TOKEN),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
  })
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  const base = `http://localhost:${info.port}`
  console.log(`Server is running on ${base}`)
  console.log(`API docs: ${base}/api/docs  ·  OpenAPI: ${base}/api/openapi.json`)
})
