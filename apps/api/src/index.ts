import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Scalar } from '@scalar/hono-api-reference'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './lib/auth.js'
import { openApiSpec } from './openapi.js'
import { debtorsRouter } from './routes/debtors.js'
import { orgsRouter } from './routes/orgs.js'
import { z } from 'zod'
import {
  lookupRequestSchema,
  lookupAgentApi,
  lookupSourceSchema,
} from './lib/lookup.js'

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
    pageTitle: 'Project Europe API',
    theme: 'default',
    content: openApiSpec,
  }),
)

app.route('/api/debtors', debtorsRouter)
app.route('/api/orgs', orgsRouter)

app.get('/hello', (c) => {
  return c.json({
    message: 'Hello from API',
    timestamp: new Date().toISOString(),
  })
})

app.get('/health', (c) => {
  return c.json({
    ok: true,
    apifyConfigured: Boolean(process.env.APIFY_TOKEN ?? process.env.APIFY_API_TOKEN),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
  })
})

const requestBodySchema = z.union([
  lookupRequestSchema,
  z.record(z.unknown()),
])

function normalizeRequestBody(body: unknown) {
  if (
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    'subject' in body
  ) {
    return lookupRequestSchema.parse(body)
  }

  return lookupRequestSchema.parse({ subject: body as Record<string, unknown> })
}

app.post('/v1/lookups/match', async (c) => {
  const body = requestBodySchema.parse(await c.req.json())
  const request = normalizeRequestBody(body)
  const pipeline = await lookupAgentApi.runMultiSourcePipeline(
    request.subject,
    request.maxResults
  )

  return c.json({
    request,
    ...pipeline,
  })
})

app.post('/v1/ingestions/match', async (c) => {
  const body = requestBodySchema.parse(await c.req.json())
  const request = normalizeRequestBody(body)
  const pipeline = await lookupAgentApi.runUnifiedIngestionPipeline(
    request.subject,
    request.maxResults
  )

  return c.json({
    request,
    ...pipeline,
  })
})

app.post('/v1/lookups/:source', async (c) => {
  const source = lookupSourceSchema.parse(c.req.param('source'))
  const body = requestBodySchema.parse(await c.req.json())
  const request = normalizeRequestBody(body)
  const pipeline = await lookupAgentApi.runLookupPipeline(
    source,
    request.subject,
    request.maxResults
  )

  return c.json({
    source,
    request,
    ...pipeline,
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
