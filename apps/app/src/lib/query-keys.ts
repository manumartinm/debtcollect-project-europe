export const queryKeys = {
  debtors: {
    all: ["debtors"] as const,
    list: (orgId: string) => ["debtors", "list", orgId] as const,
    detail: (id: string) => ["debtors", "detail", id] as const,
    statusEvents: (debtorId: string) =>
      ["debtors", "statusEvents", debtorId] as const,
    enrichedFields: (debtorId: string) =>
      ["debtors", "enrichedFields", debtorId] as const,
  },

  orgs: {
    all: ["orgs"] as const,
    list: () => ["orgs", "list"] as const,
    mine: () => ["orgs", "mine"] as const,
    detail: (id: string) => ["orgs", "detail", id] as const,
    members: (orgId: string) => ["orgs", "members", orgId] as const,
  },

  transcripts: {
    all: ["transcripts"] as const,
    list: (orgId: string) => ["transcripts", "list", orgId] as const,
    detail: (id: string) => ["transcripts", "detail", id] as const,
    byDebtor: (debtorId: string) => ["transcripts", "byDebtor", debtorId] as const,
  },

  auth: {
    session: ["auth", "session"] as const,
  },
} as const
