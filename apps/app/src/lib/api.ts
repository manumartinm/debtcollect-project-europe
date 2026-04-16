/** Backend origin (REST + Better Auth). Default matches `apps/api` dev server. */
export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

type RequestOptions = {
  headers?: HeadersInit
  body?: unknown
}

async function request<T>(
  method: string,
  path: string,
  options?: RequestOptions,
): Promise<T> {
  const headers = new Headers(options?.headers)
  if (options?.body) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  const raw = await response.text()
  let body: unknown = null
  if (raw.length > 0) {
    const t = raw.trim()
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        body = JSON.parse(raw) as unknown
      } catch {
        /* non-JSON despite brace — treat as text below on error */
      }
    }
  }

  if (!response.ok) {
    let msg = `Request failed (${response.status})`
    if (body && typeof body === "object") {
      const o = body as Record<string, unknown>
      if (typeof o.error === "string") msg = o.error
      else if (typeof o.message === "string") msg = o.message
    } else if (raw.trim()) {
      msg = raw.trim().slice(0, 500)
    }
    throw new Error(msg)
  }

  return body as T
}

export const api = {
  get<T>(path: string, opts?: RequestOptions) {
    return request<T>("GET", path, opts)
  },
  post<T>(path: string, opts?: RequestOptions) {
    return request<T>("POST", path, opts)
  },
  put<T>(path: string, opts?: RequestOptions) {
    return request<T>("PUT", path, opts)
  },
  patch<T>(path: string, opts?: RequestOptions) {
    return request<T>("PATCH", path, opts)
  },
  delete<T>(path: string, opts?: RequestOptions) {
    return request<T>("DELETE", path, opts)
  },
}

export const API_URL = API_BASE

// ---------------------------------------------------------------------------
// API response types — match Drizzle schema + relations
// ---------------------------------------------------------------------------

export type ApiTraceSource = {
  id: string
  stepId: string
  name: string
  url: string
  type: string
}

export type ApiTraceStep = {
  id: string
  enrichedFieldId: string
  stepNumber: number
  agentName: string
  action: string
  reasoning: string
  finding: string | null
  confidence: "high" | "medium" | "low" | "none"
  timestamp: string
  durationMs: number
  sources: ApiTraceSource[]
}

export type ApiEnrichedField = {
  id: string
  debtorId: string
  fieldName: string
  value: string | null
  createdAt: string
  traceSteps: ApiTraceStep[]
}

export type ApiStatusEvent = {
  id: string
  debtorId: string
  occurredAt: string
  status: string
  note: string | null
  author: string
}

export type ApiDebtor = {
  id: string
  caseRef: string
  orgId: string
  assignedTo: string | null
  debtorName: string
  country: string
  debtAmount: string
  callOutcome: string
  legalOutcome: string
  caseStatus: string
  enrichmentStatus: string
  /** Last enrichment failure message; null if never failed or after success. */
  enrichmentError: string | null
  enrichmentConfidence: number | null
  leverageScore: string
  createdAt: string
  updatedAt: string
  enrichedFields: ApiEnrichedField[]
  statusEvents: ApiStatusEvent[]
}

export type ApiOrganization = {
  id: string
  name: string
  slug: string
  createdAt: string
}

export type ApiMember = {
  id: string
  orgId: string
  userId: string
  role: "admin" | "collector" | "viewer"
  createdAt: string
  user?: { id: string; name: string; email: string; image: string | null }
}

export type ApiCallTranscript = {
  id: string
  debtorId: string
  orgId: string
  transcript: string
  callStartTime: string
  callEndTime: string
  durationSeconds: number | null
  createdAt: string
  debtor?: ApiDebtor
  organization?: ApiOrganization
}

// ---------------------------------------------------------------------------
// Endpoint functions — Debtors
// ---------------------------------------------------------------------------

export const debtorsApi = {
  list(orgId: string) {
    return api.get<ApiDebtor[]>(`/api/debtors?orgId=${orgId}`)
  },

  get(id: string) {
    return api.get<ApiDebtor>(`/api/debtors/${id}`)
  },

  create(data: {
    caseRef: string
    orgId: string
    debtorName: string
    country: string
    debtAmount: number
    callOutcome?: string
    legalOutcome?: string
  }) {
    return api.post<ApiDebtor>("/api/debtors", { body: data })
  },

  bulkCreate(data: {
    orgId: string
    rows: Array<{
      caseRef: string
      debtorName: string
      country: string
      debtAmount: number
      callOutcome?: string
      legalOutcome?: string
      enriched?: Partial<
        Record<"phone" | "address" | "email" | "tax_id", string>
      >
    }>
  }) {
    return api.post<{ imported: number }>("/api/debtors/bulk", { body: data })
  },

  /** Manual enrichment — starts Trigger.dev research pipeline. */
  enrich(id: string) {
    return api.post<{
      runId: string
      /** Scoped token for [@trigger.dev/react-hooks](https://trigger.dev/docs/realtime/overview) `useRealtimeRun`. */
      publicAccessToken: string
      debtor: ApiDebtor
    }>(`/api/debtors/${encodeURIComponent(id)}/enrich`)
  },

  /** Start a fake AI agent call for a debtor (demo). */
  aiCall(id: string) {
    return api.post<{
      callId: string
      debtorId: string
      status: string
      message: string
    }>(`/api/debtors/${encodeURIComponent(id)}/ai-call`)
  },

  enrichBatch(debtorIds: string[]) {
    return api.post<{
      started: number
      skipped: string[]
      errors: Array<{ id: string; error: string }>
    }>("/api/debtors/enrich-batch", { body: { debtorIds } })
  },

  update(
    id: string,
    patch: Partial<{
      debtorName: string
      country: string
      debtAmount: number
      callOutcome: string
      legalOutcome: string
      caseStatus: string
      enrichmentStatus: string
      enrichmentConfidence: number
      leverageScore: string
      assignedTo: string | null
    }>,
  ) {
    return api.patch<ApiDebtor>(`/api/debtors/${id}`, { body: patch })
  },

  delete(id: string) {
    return api.delete<{ deleted: boolean }>(`/api/debtors/${id}`)
  },

  setStatus(
    id: string,
    data: { status: string; note?: string; author: string },
  ) {
    return api.post<ApiStatusEvent>(`/api/debtors/${id}/status`, {
      body: data,
    })
  },

  getStatusEvents(id: string) {
    return api.get<ApiStatusEvent[]>(`/api/debtors/${id}/status-events`)
  },

  getEnrichedFields(id: string) {
    return api.get<ApiEnrichedField[]>(`/api/debtors/${id}/enriched-fields`)
  },

  upsertEnrichedField(
    debtorId: string,
    data: {
      fieldName: string
      value: string | null
      traceSteps?: Array<{
        stepNumber: number
        agentName: string
        action: string
        reasoning: string
        finding: string | null
        confidence: string
        durationMs: number
        sources?: Array<{ name: string; url: string; type: string }>
      }>
    },
  ) {
    return api.post<ApiEnrichedField>(
      `/api/debtors/${debtorId}/enriched-fields`,
      { body: data },
    )
  },
}

// ---------------------------------------------------------------------------
// Endpoint functions — Organizations
// ---------------------------------------------------------------------------

export const orgsApi = {
  list() {
    return api.get<ApiOrganization[]>("/api/orgs")
  },

  /** Organizations the current user belongs to (requires session). */
  mine() {
    return api.get<ApiOrganization[]>("/api/orgs/mine")
  },

  get(id: string) {
    return api.get<ApiOrganization>(`/api/orgs/${id}`)
  },

  create(data: { name: string; slug: string }) {
    return api.post<ApiOrganization>("/api/orgs", { body: data })
  },

  update(id: string, patch: Partial<{ name: string; slug: string }>) {
    return api.patch<ApiOrganization>(`/api/orgs/${id}`, { body: patch })
  },

  members: {
    list(orgId: string) {
      return api.get<ApiMember[]>(`/api/orgs/${orgId}/members`)
    },

    add(orgId: string, data: { userId: string; role?: string }) {
      return api.post<ApiMember>(`/api/orgs/${orgId}/members`, { body: data })
    },

    updateRole(orgId: string, memberId: string, role: string) {
      return api.patch<ApiMember>(`/api/orgs/${orgId}/members/${memberId}`, {
        body: { role },
      })
    },

    remove(orgId: string, memberId: string) {
      return api.delete<{ deleted: boolean }>(
        `/api/orgs/${orgId}/members/${memberId}`,
      )
    },
  },
}

// ---------------------------------------------------------------------------
// Endpoint functions — Transcripts
// ---------------------------------------------------------------------------

export const transcriptsApi = {
  list(orgId: string) {
    return api.get<ApiCallTranscript[]>(`/api/transcripts?orgId=${orgId}`)
  },

  get(id: string) {
    return api.get<ApiCallTranscript>(`/api/transcripts/${id}`)
  },

  getByDebtor(debtorId: string) {
    return api.get<ApiCallTranscript[]>(`/api/transcripts/debtor/${debtorId}`)
  },
}
