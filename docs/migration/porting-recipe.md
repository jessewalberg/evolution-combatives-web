# Next.js → TanStack Start porting recipe

Authoritative conversion rules for porting `app/` pages and API routes to
TanStack Start. Phases 1–3 already migrated the platform: build (Vite 8 +
Cloudflare Workers), Supabase SSR auth, request middleware (security
headers/CSRF/rate-limit/auth guard), webhooks, and mobile endpoints. Follow
these rules exactly; the patterns are proven by the already-ported code.

## Setup in a fresh worktree

```bash
CI=true pnpm install        # fast, shared store
pnpm exec vite build        # generates src/routeTree.gen.ts (gitignored)
```

## Page ports (`app/<path>/page.tsx` → `src/routes/...`)

Route file mapping uses TanStack file conventions: `[id]` → `$id`,
`page.tsx` → `<name>.tsx` or `<dir>/index.tsx`. Existing layout routes
`src/routes/dashboard/route.tsx` and `src/routes/users/route.tsx` already
wrap their children (AdminLayout + auth) — do NOT recreate layouts, just add
leaf routes beneath them.

Transform the page component:

1. Delete the `'use client'` directive and any `export const metadata` /
   `export const dynamic`.
2. `export default function X()` → `export function X()` (named export kept
   for tests), and register:
   ```tsx
   import { createFileRoute } from '@tanstack/react-router'
   export const Route = createFileRoute('/dashboard/content/videos/')({
       component: VideosPage,
   })
   ```
   (Note: index routes under a layout use a trailing `/` in the id — follow
   the generator error message if unsure; `pnpm exec vite build` regenerates
   and validates.)
3. Rewrite relative imports `../../src/...` → `@/src/...`.
4. Import swaps (shims keep prop shapes identical):
   - `import Link from 'next/link'` → `import Link from '@/src/components/compat/link'`
   - `import Image from 'next/image'` → `import Image from '@/src/components/compat/image'`
5. Navigation hooks — use ONLY top-level importable hooks (mockable in
   tests exactly like the old next/navigation mocks):
   - `useRouter().push(path)` → `const navigate = useNavigate()` then
     `navigate({ to: path as never })`. If the string contains a query
     (`'/x?y=z'`), split it: `navigate({ to: '/x' as never, search: { y: 'z' } })`.
   - `router.replace(p)` → `navigate({ to: p as never, replace: true })`
   - `router.back()` → `window.history.back()`
   - `router.refresh()` → `useRouter()` from `@tanstack/react-router`, then
     `router.invalidate()`
   - `useParams()` → `useParams({ strict: false })` from `@tanstack/react-router`
   - `useSearchParams()` → `useSearch({ strict: false })` from
     `@tanstack/react-router`; `searchParams.get('x')` → `(search as any).x`.
     Remove `<Suspense>` wrappers that existed only for useSearchParams.
   - `usePathname()` → `useLocation({ select: (l) => l.pathname })`
6. If the page reads search params, add a loose validator on the route:
   `validateSearch: (search: Record<string, unknown>) => search as { x?: string }`.

## API route ports (`app/api/<path>/route.ts` → `src/server/` + `src/routes/api/`)

Handler logic lives in `src/server/<path>.ts` (kebab/flattened, e.g.
`app/api/content/categories/[id]/route.ts` → `src/server/content/categories-id.ts`);
the route file is a thin registration. Follow `src/server/webhooks/stripe.ts`
and `src/routes/api/webhooks/stripe.ts` as the reference.

1. Replace `import { NextRequest, NextResponse } from 'next/server'` with
   `import { json } from '@/src/lib/http'`; every `NextResponse.json(` →
   `json(`.
2. Handler signatures:
   - `export async function POST(request: NextRequest)` →
     `export async function POST({ request }: { request: Request })`
   - `(request: NextRequest, { params }: { params: Promise<{ id: string }> })` →
     `({ request, params }: { request: Request; params: { id: string } })`,
     and remove `await params`.
   - `request.nextUrl.searchParams` → `new URL(request.url).searchParams`
3. Auth: `validateApiAuthWithSession('perm')` works unchanged (reads session
   cookies via Start context). `validateApiAuth(request, 'perm')` is now
   async — add `await`.
4. Cookies: `cookies()` from next/headers →
   `const { getCookie, setCookie } = await import('@tanstack/react-start/server')`.
5. Registration file `src/routes/api/<path>.ts` (dynamic segments use `$id`):
   ```ts
   import { createFileRoute } from '@tanstack/react-router'
   import { GET, POST } from '@/src/server/content/categories'
   export const Route = createFileRoute('/api/content/categories')({
       server: { handlers: { GET, POST } },
   })
   ```
6. zod 4 is installed: `ZodError.errors` no longer exists — use `.issues`.

## Tests

- Move `app/api/**/route.test.ts` → next to the `src/server/` module
  (`<module>.test.ts`). Keep tests intact; adapt only:
  - `import { POST } from './route'` → import from the new module, and wrap:
    `import { POST as POSTHandler } from './x'` +
    `const POST = (request?: Request) => POSTHandler({ request: request ?? new Request('http://localhost/') } as never)`
    (for param routes, pass `{ request, params }`).
  - Fix moved relative imports (`../../../src/...` → `@/src/...`).
- Page tests move next to the route file (colocated `.test.tsx` is safe —
  the generator ignores them). Mock swaps:
  - `vi.mock('next/link')` → `vi.mock('@/src/components/compat/link')`
  - `vi.mock('next/image')` → `vi.mock('@/src/components/compat/image')`
  - `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))`
    → `vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mockPush, useSearch: () => ({}), useParams: () => ({}), useLocation: () => ({ pathname: '/x' }) }))`
    (include whichever hooks the component uses); assertions change from
    `mockPush).toHaveBeenCalledWith('/x')` to `({ to: '/x' })`.

## Type errors

Your ported files must be `tsc`-clean: check with
`pnpm exec vite build && pnpm exec tsc --noEmit 2>&1 | grep -E '<your files>'`.
Pre-existing errors in files you don't own are NOT yours to fix. Where the
typed Supabase browser client reports `never` rows (stale shared Database
type), use a local `as` cast at the query site — do NOT edit
`src/lib/shared/**` (that tree is shared with the mobile repo) unless the
change is type-only and unavoidable.

## Hard rules

- URLs must not change — mobile app and external callers depend on them.
- Do NOT edit: `src/routes/__root.tsx`, `src/start.ts`, `vite.config.ts`,
  `package.json`, `wrangler.jsonc`, `vitest.config.ts`,
  `src/lib/{supabase,csrf-protection,rate-limit,api-auth,http,mobile-auth}.ts`,
  `src/hooks/useAuth.ts`, `src/components/**` (shared, already ported), or
  another slice's files. If blocked by one of these, report it instead.
- Delete each legacy `app/...` file you port (git rm), including its test.
- 4-space indent, JSDoc headers preserved, match surrounding style.

## Definition of done

1. `pnpm exec vite build` passes (route tree valid).
2. `pnpm exec vitest run` passes (whole suite, not just your files).
3. `pnpm exec tsc --noEmit` reports no errors in files you created/ported.
4. Legacy files deleted.
5. All work committed on the current branch with a descriptive message.
