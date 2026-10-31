/** Stable TanStack Query keys, one namespace per resource. Invalidate by prefix (e.g. `qk.alerts.all`). */
export const qk = {
  me: ['me'] as const,
  profile: ['profile'] as const,
  universe: ['universe'] as const,
  onboardingQuestions: ['onboarding', 'questions'] as const,
  watchlist: ['watchlist'] as const,
  quotes: {
    all: ['quotes'] as const,
    list: (symbols: readonly string[]) => ['quotes', 'list', [...symbols].sort().join(',')] as const,
    bars: (symbol: string, interval: string, limit?: number) =>
      ['quotes', 'bars', symbol, interval, limit ?? null] as const,
  },
  market: ['market', 'status'] as const,
  portfolio: {
    all: ['portfolio'] as const,
    summary: ['portfolio', 'summary'] as const,
    risk: ['portfolio', 'risk'] as const,
    performance: ['portfolio', 'performance'] as const,
  },
  proposals: {
    all: ['proposals'] as const,
    list: (status?: string) => ['proposals', 'list', status ?? 'all'] as const,
    detail: (id: string) => ['proposals', 'detail', id] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    list: (f: { type?: string; state?: string } = {}) =>
      ['alerts', 'list', f.type ?? 'all', f.state ?? 'all'] as const,
  },
  feed: ['feed'] as const,
  why: (type: string, id: string) => ['why', type, id] as const,
  briefs: {
    all: ['briefs'] as const,
    detail: (symbol: string) => ['briefs', 'detail', symbol.toUpperCase()] as const,
    citation: (id: string) => ['briefs', 'citation', id] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: ['orders', 'list'] as const,
  },
  chat: { history: ['chat', 'history'] as const },
  audit: {
    traces: ['audit', 'traces'] as const,
    trace: (id: string) => ['audit', 'trace', id] as const,
    evals: ['audit', 'evals'] as const,
  },
} as const;
