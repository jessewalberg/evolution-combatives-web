import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { authSuccess, authFail } from '@/test/helpers/auth'
import { GET, PUT, DELETE } from './route'

vi.mock('../../../../../src/lib/api-auth', () => ({
  validateApiAuthWithSession: vi.fn(),
}))

vi.mock('../../../../../src/services/content', () => ({
  contentQueries: { fetchDisciplines: vi.fn() },
  contentMutations: {
    updateDiscipline: vi.fn(),
    deleteDiscipline: vi.fn(),
  },
}))

import { validateApiAuthWithSession } from '../../../../../src/lib/api-auth'
import { contentQueries, contentMutations } from '../../../../../src/services/content'

const mockAuth = vi.mocked(validateApiAuthWithSession)
const mockFetchDisciplines = vi.mocked(contentQueries.fetchDisciplines)
const mockUpdateDiscipline = vi.mocked(contentMutations.updateDiscipline)
const mockDeleteDiscipline = vi.mocked(contentMutations.deleteDiscipline)

const params = { params: Promise.resolve({ id: 'd1' }) }

describe('GET /api/content/disciplines/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    authFail(mockAuth, 401)
    const res = await GET(createNextRequest('/api/content/disciplines/d1'), params)
    expect(res.status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    authSuccess(mockAuth)
    mockFetchDisciplines.mockResolvedValue([{ id: 'other' }] as never)

    const res = await GET(createNextRequest('/api/content/disciplines/d1'), params)
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Discipline not found')
  })

  it('returns discipline on success', async () => {
    authSuccess(mockAuth)
    const discipline = { id: 'd1', name: 'Jiu Jitsu' }
    mockFetchDisciplines.mockResolvedValue([discipline] as never)

    const res = await GET(createNextRequest('/api/content/disciplines/d1'), params)
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.read')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: discipline })
    expect(mockFetchDisciplines).toHaveBeenCalledWith(true)
  })

  it('returns 500 when fetch throws', async () => {
    authSuccess(mockAuth)
    mockFetchDisciplines.mockRejectedValue(new Error('fail'))

    const res = await GET(createNextRequest('/api/content/disciplines/d1'), params)
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/content/disciplines/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    authFail(mockAuth, 403)
    const res = await PUT(
      createNextRequest('/api/content/disciplines/d1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
      }),
      params
    )
    expect(res.status).toBe(403)
  })

  it('updates discipline', async () => {
    authSuccess(mockAuth)
    const updated = { id: 'd1', name: 'Updated' }
    mockUpdateDiscipline.mockResolvedValue(updated as never)

    const res = await PUT(
      createNextRequest('/api/content/disciplines/d1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated',
          slug: 'updated',
          description: 'desc',
          color: '#000',
          icon: 'icon',
          subscription_tier_required: 'tier2',
          sort_order: 1,
          is_active: false,
        }),
      }),
      params
    )
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, data: updated })
    expect(mockUpdateDiscipline).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({ name: 'Updated', is_active: false })
    )
  })

  it('returns 500 when update throws', async () => {
    authSuccess(mockAuth)
    mockUpdateDiscipline.mockRejectedValue(new Error('update fail'))

    const res = await PUT(
      createNextRequest('/api/content/disciplines/d1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'x' }),
      }),
      params
    )
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/content/disciplines/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns auth error', async () => {
    authFail(mockAuth, 401)
    const res = await DELETE(
      createNextRequest('/api/content/disciplines/d1', { method: 'DELETE' }),
      params
    )
    expect(res.status).toBe(401)
  })

  it('deletes discipline', async () => {
    authSuccess(mockAuth)
    mockDeleteDiscipline.mockResolvedValue(undefined as never)

    const res = await DELETE(
      createNextRequest('/api/content/disciplines/d1', { method: 'DELETE' }),
      params
    )
    const body = await res.json()

    expect(mockAuth).toHaveBeenCalledWith('content.write')
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(mockDeleteDiscipline).toHaveBeenCalledWith('d1')
  })

  it('returns 500 when delete throws', async () => {
    authSuccess(mockAuth)
    mockDeleteDiscipline.mockRejectedValue(new Error('blocked'))

    const res = await DELETE(
      createNextRequest('/api/content/disciplines/d1', { method: 'DELETE' }),
      params
    )
    expect(res.status).toBe(500)
  })
})
