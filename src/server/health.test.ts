import { describe, it, expect } from 'vitest'
import { GET as GETHandler } from './health'
const GET = (request?: Request) => GETHandler({ request: request ?? new Request('http://localhost/') } as never)

describe('GET /api/health', () => {
  it('returns healthy status', async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.status).toBe('healthy')
    expect(body.timestamp).toBeDefined()
    expect(body.environment).toBe('test')
    expect(body.version).toBeDefined()
  })
})
