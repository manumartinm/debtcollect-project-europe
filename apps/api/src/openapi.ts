/**
 * OpenAPI 3.1 document for the HTTP API (served at GET /api/openapi.json and /api/docs).
 */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Project Europe API',
    version: '1.0.0',
    description:
      'REST API for organizations, debtors (cases), enrichment fields, and status history.\n\n' +
      '**Authentication** — Session-based auth via [Better Auth](https://www.better-auth.com/docs) at `/api/auth/*`. ' +
      'Send requests with `credentials: include` so session cookies are sent. ' +
      'Unauthenticated requests to protected routes may return `401` depending on route wiring.\n\n' +
      '**Identifiers** — Debtors are addressed by UUID (`id`). Business references use `caseRef` (unique per org in practice via unique constraint on `case_ref`).',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
  ],
  tags: [
    { name: 'Health', description: 'Liveness' },
    { name: 'Debtors', description: 'Debtor (case) CRUD, bulk import, status, enriched fields' },
    { name: 'Organizations', description: 'Organizations and membership' },
  ],
  paths: {
    '/hello': {
      get: {
        tags: ['Health'],
        summary: 'Hello',
        description: 'Simple JSON response for connectivity checks.',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/debtors': {
      get: {
        tags: ['Debtors'],
        summary: 'List debtors by organization',
        parameters: [
          {
            name: 'orgId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Organization UUID',
          },
        ],
        responses: {
          '200': {
            description: 'Array of debtors with relations',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DebtorWithRelations' },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
      post: {
        tags: ['Debtors'],
        summary: 'Create debtor',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DebtorCreate' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DebtorWithRelations' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/debtors/bulk': {
      post: {
        tags: ['Debtors'],
        summary: 'Bulk create debtors',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BulkDebtorCreate' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Import summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    imported: { type: 'integer' },
                  },
                  required: ['imported'],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/debtors/by-case-ref/{caseRef}': {
      get: {
        tags: ['Debtors'],
        summary: 'Get debtor by case reference',
        description: 'Looks up by unique `caseRef` (URL-encoded path segment).',
        parameters: [
          {
            name: 'caseRef',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DebtorWithRelations' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/debtors/{id}': {
      get: {
        tags: ['Debtors'],
        summary: 'Get debtor by UUID',
        parameters: [{ $ref: '#/components/parameters/DebtorId' }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DebtorWithRelations' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Debtors'],
        summary: 'Update debtor',
        parameters: [{ $ref: '#/components/parameters/DebtorId' }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DebtorPatch' },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DebtorWithRelations' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Debtors'],
        summary: 'Delete debtor',
        parameters: [{ $ref: '#/components/parameters/DebtorId' }],
        responses: {
          '200': {
            description: 'Deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { deleted: { type: 'boolean', const: true } },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/debtors/{id}/status-events': {
      get: {
        tags: ['Debtors'],
        summary: 'List status events',
        parameters: [{ $ref: '#/components/parameters/DebtorId' }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/StatusEvent' },
                },
              },
            },
          },
        },
      },
    },
    '/api/debtors/{id}/status': {
      post: {
        tags: ['Debtors'],
        summary: 'Append status change',
        parameters: [{ $ref: '#/components/parameters/DebtorId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StatusSetBody' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusEvent' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/debtors/{id}/enriched-fields': {
      get: {
        tags: ['Debtors'],
        summary: 'List enriched fields (with trace steps)',
        parameters: [{ $ref: '#/components/parameters/DebtorId' }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/EnrichedFieldWithTraces' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Debtors'],
        summary: 'Upsert enriched field',
        parameters: [{ $ref: '#/components/parameters/DebtorId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EnrichedFieldUpsert' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created or updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EnrichedFieldWithTraces' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/orgs': {
      get: {
        tags: ['Organizations'],
        summary: 'List organizations',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Organization' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Create organization',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrganizationCreate' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Organization' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '409': {
            description: 'Conflict (e.g. slug taken)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorBody' },
              },
            },
          },
        },
      },
    },
    '/api/orgs/{id}': {
      get: {
        tags: ['Organizations'],
        summary: 'Get organization',
        parameters: [{ $ref: '#/components/parameters/OrgId' }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Organization' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Organizations'],
        summary: 'Update organization',
        parameters: [{ $ref: '#/components/parameters/OrgId' }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OrganizationPatch' },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Organization' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/orgs/{orgId}/members': {
      get: {
        tags: ['Organizations'],
        summary: 'List members (with user info when available)',
        parameters: [{ $ref: '#/components/parameters/OrgIdParam' }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Member' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Organizations'],
        summary: 'Add member',
        parameters: [{ $ref: '#/components/parameters/OrgIdParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MemberAdd' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Member' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/orgs/{orgId}/members/{memberId}': {
      patch: {
        tags: ['Organizations'],
        summary: 'Update member role',
        parameters: [
          { $ref: '#/components/parameters/OrgIdParam' },
          { $ref: '#/components/parameters/MemberId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: {
                    type: 'string',
                    enum: ['admin', 'collector', 'viewer'],
                  },
                },
                required: ['role'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Member' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Organizations'],
        summary: 'Remove member',
        parameters: [
          { $ref: '#/components/parameters/OrgIdParam' },
          { $ref: '#/components/parameters/MemberId' },
        ],
        responses: {
          '200': {
            description: 'Removed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { deleted: { type: 'boolean', const: true } },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
  components: {
    parameters: {
      DebtorId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Debtor UUID',
      },
      OrgId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Organization UUID',
      },
      OrgIdParam: {
        name: 'orgId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
      MemberId: {
        name: 'memberId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorBody' },
          },
        },
      },
      NotFound: {
        description: 'Not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorBody' },
          },
        },
      },
    },
    schemas: {
      ErrorBody: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
        required: ['error'],
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'name', 'slug', 'createdAt'],
      },
      OrganizationCreate: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
        },
        required: ['name', 'slug'],
      },
      OrganizationPatch: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
        },
      },
      Member: {
        type: 'object',
        description: 'Shape matches Drizzle query (may include nested `user`).',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orgId: { type: 'string', format: 'uuid' },
          userId: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'collector', 'viewer'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      MemberAdd: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'collector', 'viewer'] },
        },
        required: ['userId'],
      },
      DebtorCreate: {
        type: 'object',
        properties: {
          caseRef: { type: 'string' },
          orgId: { type: 'string', format: 'uuid' },
          debtorName: { type: 'string' },
          country: { type: 'string' },
          debtAmount: { type: 'number' },
          callOutcome: { type: 'string' },
          legalOutcome: { type: 'string' },
        },
        required: ['caseRef', 'orgId', 'debtorName', 'country', 'debtAmount'],
      },
      BulkDebtorCreate: {
        type: 'object',
        properties: {
          orgId: { type: 'string', format: 'uuid' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                caseRef: { type: 'string' },
                debtorName: { type: 'string' },
                country: { type: 'string' },
                debtAmount: { type: 'number' },
                callOutcome: { type: 'string' },
                legalOutcome: { type: 'string' },
              },
              required: ['caseRef', 'debtorName', 'country', 'debtAmount'],
            },
          },
        },
        required: ['orgId', 'rows'],
      },
      DebtorPatch: {
        type: 'object',
        properties: {
          debtorName: { type: 'string' },
          country: { type: 'string' },
          debtAmount: { type: 'number' },
          callOutcome: { type: 'string' },
          legalOutcome: { type: 'string' },
          caseStatus: { type: 'string' },
          enrichmentStatus: { type: 'string' },
          enrichmentError: { type: 'string', nullable: true },
          enrichmentConfidence: { type: 'number' },
          leverageScore: { type: 'string' },
          assignedTo: { type: 'string', nullable: true },
        },
      },
      Debtor: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          caseRef: { type: 'string' },
          orgId: { type: 'string', format: 'uuid' },
          assignedTo: { type: 'string', nullable: true },
          debtorName: { type: 'string' },
          country: { type: 'string' },
          debtAmount: { type: 'string', description: 'Numeric as string (Postgres numeric)' },
          callOutcome: { type: 'string' },
          legalOutcome: { type: 'string' },
          caseStatus: { type: 'string' },
          enrichmentStatus: { type: 'string' },
          enrichmentError: {
            type: 'string',
            nullable: true,
            description: 'Last enrichment failure (API or background task); cleared on success.',
          },
          enrichmentConfidence: { type: 'number', nullable: true },
          leverageScore: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      TraceSource: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          stepId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          url: { type: 'string' },
          type: { type: 'string' },
        },
      },
      TraceStep: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          enrichedFieldId: { type: 'string', format: 'uuid' },
          stepNumber: { type: 'integer' },
          agentName: { type: 'string' },
          action: { type: 'string' },
          reasoning: { type: 'string' },
          finding: { type: 'string', nullable: true },
          confidence: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          durationMs: { type: 'integer' },
          sources: {
            type: 'array',
            items: { $ref: '#/components/schemas/TraceSource' },
          },
        },
      },
      EnrichedFieldWithTraces: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          debtorId: { type: 'string', format: 'uuid' },
          fieldName: { type: 'string' },
          value: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          traceSteps: {
            type: 'array',
            items: { $ref: '#/components/schemas/TraceStep' },
          },
        },
      },
      EnrichedFieldUpsert: {
        type: 'object',
        properties: {
          fieldName: { type: 'string' },
          value: { type: 'string', nullable: true },
          traceSteps: { type: 'array', description: 'Optional trace payload (shape depends on model)' },
        },
        required: ['fieldName'],
      },
      StatusEvent: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          debtorId: { type: 'string', format: 'uuid' },
          occurredAt: { type: 'string', format: 'date-time' },
          status: { type: 'string' },
          note: { type: 'string', nullable: true },
          author: { type: 'string' },
        },
      },
      StatusSetBody: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          note: { type: 'string' },
          author: { type: 'string' },
        },
        required: ['status', 'author'],
      },
      DebtorWithRelations: {
        allOf: [
          { $ref: '#/components/schemas/Debtor' },
          {
            type: 'object',
            properties: {
              enrichedFields: {
                type: 'array',
                items: { $ref: '#/components/schemas/EnrichedFieldWithTraces' },
              },
              statusEvents: {
                type: 'array',
                items: { $ref: '#/components/schemas/StatusEvent' },
              },
            },
          },
        ],
      },
    },
  },
} as const

export type OpenApiDocument = typeof openApiSpec
