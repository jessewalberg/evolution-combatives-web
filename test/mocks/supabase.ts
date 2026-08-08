/**
 * Programmable fake Supabase client for unit tests.
 * Supports chained query builders: .from().select().eq()... then await / .single() / etc.
 */

import { vi } from 'vitest'

export type QueryResult = {
  data: unknown
  error: unknown
  count?: number | null
}

type Resolver = QueryResult | ((state: QueryState) => QueryResult | Promise<QueryResult>)

export interface QueryState {
  table: string
  method: string
  filters: Array<{ type: string; args: unknown[] }>
  payload?: unknown
  options?: unknown
}

export interface FakeQueryBuilder extends PromiseLike<QueryResult> {
  select: (...args: unknown[]) => FakeQueryBuilder
  insert: (...args: unknown[]) => FakeQueryBuilder
  update: (...args: unknown[]) => FakeQueryBuilder
  upsert: (...args: unknown[]) => FakeQueryBuilder
  delete: (...args: unknown[]) => FakeQueryBuilder
  eq: (...args: unknown[]) => FakeQueryBuilder
  neq: (...args: unknown[]) => FakeQueryBuilder
  gt: (...args: unknown[]) => FakeQueryBuilder
  gte: (...args: unknown[]) => FakeQueryBuilder
  lt: (...args: unknown[]) => FakeQueryBuilder
  lte: (...args: unknown[]) => FakeQueryBuilder
  like: (...args: unknown[]) => FakeQueryBuilder
  ilike: (...args: unknown[]) => FakeQueryBuilder
  is: (...args: unknown[]) => FakeQueryBuilder
  in: (...args: unknown[]) => FakeQueryBuilder
  contains: (...args: unknown[]) => FakeQueryBuilder
  or: (...args: unknown[]) => FakeQueryBuilder
  not: (...args: unknown[]) => FakeQueryBuilder
  order: (...args: unknown[]) => FakeQueryBuilder
  limit: (...args: unknown[]) => FakeQueryBuilder
  range: (...args: unknown[]) => FakeQueryBuilder
  single: () => FakeQueryBuilder
  maybeSingle: () => FakeQueryBuilder
  match: (...args: unknown[]) => FakeQueryBuilder
  filter: (...args: unknown[]) => FakeQueryBuilder
  then: PromiseLike<QueryResult>['then']
}

export interface FakeAuthAdmin {
  getUserById: ReturnType<typeof vi.fn>
  deleteUser: ReturnType<typeof vi.fn>
  updateUserById: ReturnType<typeof vi.fn>
}

export interface FakeAuth {
  getSession: ReturnType<typeof vi.fn>
  getUser: ReturnType<typeof vi.fn>
  signInWithPassword: ReturnType<typeof vi.fn>
  signUp: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  resetPasswordForEmail: ReturnType<typeof vi.fn>
  updateUser: ReturnType<typeof vi.fn>
  refreshSession: ReturnType<typeof vi.fn>
  signInWithOAuth: ReturnType<typeof vi.fn>
  onAuthStateChange: ReturnType<typeof vi.fn>
  admin: FakeAuthAdmin
}

export interface FakeChannel {
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
  track: ReturnType<typeof vi.fn>
  untrack: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  presenceState: ReturnType<typeof vi.fn>
}

export interface FakeSupabaseClient {
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
  channel: ReturnType<typeof vi.fn>
  auth: FakeAuth
  realtime?: { connectionState: () => string; reconnect?: () => Promise<void> }
  /** Queue a result for the next matching from()/rpc() call */
  queueResult: (result: Resolver) => void
  /** Map table name → resolver (used when queue is empty) */
  setTableResult: (table: string, result: Resolver) => void
  /** Clear queues and table maps */
  reset: () => void
  /** Inspect recorded query calls */
  calls: QueryState[]
  /** Get last created channel (for realtime tests) */
  lastChannel: FakeChannel | null
}

function createBuilder(
  client: FakeSupabaseClient,
  table: string,
  method: string,
  payload?: unknown,
  options?: unknown
): FakeQueryBuilder {
  const state: QueryState = {
    table,
    method,
    filters: [],
    payload,
    options,
  }
  client.calls.push(state)

  const resolve = async (): Promise<QueryResult> => {
    const queued = (client as unknown as { _queue: Resolver[] })._queue
    const tableMap = (client as unknown as { _tableMap: Map<string, Resolver> })._tableMap

    let resolver: Resolver | undefined
    if (queued.length > 0) {
      resolver = queued.shift()
    } else if (tableMap.has(table)) {
      resolver = tableMap.get(table)
    }

    if (!resolver) {
      return { data: null, error: null, count: 0 }
    }

    if (typeof resolver === 'function') {
      return await resolver(state)
    }
    return resolver
  }

  const builder = {
    select(...args: unknown[]) {
      state.filters.push({ type: 'select', args })
      return builder
    },
    insert(...args: unknown[]) {
      state.method = 'insert'
      state.payload = args[0]
      state.filters.push({ type: 'insert', args })
      return builder
    },
    update(...args: unknown[]) {
      state.method = 'update'
      state.payload = args[0]
      state.filters.push({ type: 'update', args })
      return builder
    },
    upsert(...args: unknown[]) {
      state.method = 'upsert'
      state.payload = args[0]
      state.filters.push({ type: 'upsert', args })
      return builder
    },
    delete(...args: unknown[]) {
      state.method = 'delete'
      state.filters.push({ type: 'delete', args })
      return builder
    },
    eq(...args: unknown[]) {
      state.filters.push({ type: 'eq', args })
      return builder
    },
    neq(...args: unknown[]) {
      state.filters.push({ type: 'neq', args })
      return builder
    },
    gt(...args: unknown[]) {
      state.filters.push({ type: 'gt', args })
      return builder
    },
    gte(...args: unknown[]) {
      state.filters.push({ type: 'gte', args })
      return builder
    },
    lt(...args: unknown[]) {
      state.filters.push({ type: 'lt', args })
      return builder
    },
    lte(...args: unknown[]) {
      state.filters.push({ type: 'lte', args })
      return builder
    },
    like(...args: unknown[]) {
      state.filters.push({ type: 'like', args })
      return builder
    },
    ilike(...args: unknown[]) {
      state.filters.push({ type: 'ilike', args })
      return builder
    },
    is(...args: unknown[]) {
      state.filters.push({ type: 'is', args })
      return builder
    },
    in(...args: unknown[]) {
      state.filters.push({ type: 'in', args })
      return builder
    },
    contains(...args: unknown[]) {
      state.filters.push({ type: 'contains', args })
      return builder
    },
    or(...args: unknown[]) {
      state.filters.push({ type: 'or', args })
      return builder
    },
    not(...args: unknown[]) {
      state.filters.push({ type: 'not', args })
      return builder
    },
    order(...args: unknown[]) {
      state.filters.push({ type: 'order', args })
      return builder
    },
    limit(...args: unknown[]) {
      state.filters.push({ type: 'limit', args })
      return builder
    },
    range(...args: unknown[]) {
      state.filters.push({ type: 'range', args })
      return builder
    },
    single() {
      state.filters.push({ type: 'single', args: [] })
      return builder
    },
    maybeSingle() {
      state.filters.push({ type: 'maybeSingle', args: [] })
      return builder
    },
    match(...args: unknown[]) {
      state.filters.push({ type: 'match', args })
      return builder
    },
    filter(...args: unknown[]) {
      state.filters.push({ type: 'filter', args })
      return builder
    },
    then(onFulfilled?: ((value: QueryResult) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) {
      return resolve().then(onFulfilled as (value: QueryResult) => unknown, onRejected as (reason: unknown) => unknown)
    },
  } as FakeQueryBuilder

  return builder
}

export function createFakeChannel(): FakeChannel {
  const channel: FakeChannel = {
    on: vi.fn(function (this: FakeChannel) {
      return this
    }),
    subscribe: vi.fn(function (this: FakeChannel, cb?: (status: string) => void) {
      if (typeof cb === 'function') {
        cb('SUBSCRIBED')
      }
      return this
    }),
    unsubscribe: vi.fn(async () => 'ok'),
    track: vi.fn(async () => 'ok'),
    untrack: vi.fn(async () => 'ok'),
    send: vi.fn(async () => 'ok'),
    presenceState: vi.fn(() => ({})),
  }
  // Make .on chainable returning channel
  channel.on.mockImplementation(function (this: FakeChannel) {
    return this
  })
  channel.subscribe.mockImplementation(function (this: FakeChannel, cb?: (status: string) => void) {
    if (typeof cb === 'function') {
      void Promise.resolve().then(() => cb('SUBSCRIBED'))
    }
    return this
  })
  return channel
}

export function createFakeSupabaseClient(): FakeSupabaseClient {
  const _queue: Resolver[] = []
  const _tableMap = new Map<string, Resolver>()
  const calls: QueryState[] = []
  let lastChannel: FakeChannel | null = null

  const authAdmin: FakeAuthAdmin = {
    getUserById: vi.fn(async () => ({ data: { user: null }, error: null })),
    deleteUser: vi.fn(async () => ({ data: null, error: null })),
    updateUserById: vi.fn(async () => ({ data: { user: null }, error: null })),
  }

  const auth: FakeAuth = {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
    signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: null, error: null })),
    updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    refreshSession: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: { url: null, provider: 'google' }, error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    admin: authAdmin,
  }

  const client = {
    calls,
    lastChannel,
    _queue,
    _tableMap,
    from: vi.fn((table: string) => createBuilder(client as unknown as FakeSupabaseClient, table, 'select')),
    rpc: vi.fn((fn: string, params?: unknown) =>
      createBuilder(client as unknown as FakeSupabaseClient, `rpc:${fn}`, 'rpc', params)
    ),
    channel: vi.fn((name: string) => {
      lastChannel = createFakeChannel()
      ;(client as { lastChannel: FakeChannel | null }).lastChannel = lastChannel
      void name
      return lastChannel
    }),
    auth,
    realtime: {
      connectionState: () => 'connected',
      reconnect: async () => undefined,
    },
    queueResult(result: Resolver) {
      _queue.push(result)
    },
    setTableResult(table: string, result: Resolver) {
      _tableMap.set(table, result)
    },
    reset() {
      _queue.length = 0
      _tableMap.clear()
      calls.length = 0
      lastChannel = null
      ;(client as { lastChannel: FakeChannel | null }).lastChannel = null
      // Clear call history but keep default mock implementations
      for (const fn of Object.values(auth)) {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          ;(fn as ReturnType<typeof vi.fn>).mockClear()
        }
      }
      for (const fn of Object.values(authAdmin)) {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          ;(fn as ReturnType<typeof vi.fn>).mockClear()
        }
      }
      client.from.mockClear()
      client.rpc.mockClear()
      client.channel.mockClear()
    },
  }

  return client as unknown as FakeSupabaseClient
}
