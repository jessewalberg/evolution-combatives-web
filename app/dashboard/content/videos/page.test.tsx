import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const {
  mockPush,
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
  mockFetchVideos,
  mockFetchCategories,
  mockFetchDisciplines,
  mockDeleteVideo,
  mockHasPermission,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
  mockFetchVideos: vi.fn(),
  mockFetchCategories: vi.fn(),
  mockFetchDisciplines: vi.fn(),
  mockDeleteVideo: vi.fn(),
  mockHasPermission: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    warning: vi.fn(),
  },
}))

vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'admin@test.com' },
    profile: { id: 'u1', admin_role: 'content_admin', full_name: 'Admin' },
    hasPermission: mockHasPermission,
    isLoading: false,
  }),
}))

vi.mock('../../../../src/services/content-client', () => ({
  clientContentService: {
    fetchVideos: (...args: unknown[]) => mockFetchVideos(...args),
    fetchCategories: (...args: unknown[]) => mockFetchCategories(...args),
    fetchDisciplines: (...args: unknown[]) => mockFetchDisciplines(...args),
    deleteVideo: (...args: unknown[]) => mockDeleteVideo(...args),
    bulkUpdateVideoStatus: vi.fn(),
    bulkDeleteVideos: vi.fn(),
  },
}))

import VideoLibraryPage from './page'

const videos = [
  {
    id: 'vid-1',
    title: 'Guard Pass Fundamentals',
    description: 'Passing closed guard',
    category_id: 'cat-1',
    processing_status: 'ready',
    tier_required: 'tier1',
    created_at: '2024-05-01T00:00:00.000Z',
    updated_at: '2024-05-02T00:00:00.000Z',
    view_count: 100,
    duration_seconds: 120,
    thumbnail_url: null,
    tags: [],
    cloudflare_video_id: 'cf-1',
  },
  {
    id: 'vid-2',
    title: 'Mount Escape Drill',
    description: 'Escaping side mount',
    category_id: 'cat-2',
    processing_status: 'processing',
    tier_required: 'tier2',
    created_at: '2024-04-01T00:00:00.000Z',
    updated_at: '2024-04-02T00:00:00.000Z',
    view_count: 50,
    duration_seconds: 90,
    thumbnail_url: null,
    tags: [],
    cloudflare_video_id: 'cf-2',
  },
  {
    id: 'vid-3',
    title: 'Armbar Setup',
    description: 'From closed guard',
    category_id: 'cat-1',
    processing_status: 'ready',
    tier_required: 'tier1',
    created_at: '2024-03-01T00:00:00.000Z',
    updated_at: '2024-03-02T00:00:00.000Z',
    view_count: 25,
    duration_seconds: 60,
    thumbnail_url: null,
    tags: [],
    cloudflare_video_id: 'cf-3',
  },
]

const categories = [
  { id: 'cat-1', name: 'Fundamentals', discipline_id: 'disc-1' },
  { id: 'cat-2', name: 'Escapes', discipline_id: 'disc-2' },
]

const disciplines = [
  { id: 'disc-1', name: 'Jiu Jitsu' },
  { id: 'disc-2', name: 'Wrestling' },
]

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <VideoLibraryPage />
    </QueryClientProvider>
  )
}

describe('VideoLibraryPage', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasPermission.mockImplementation((perm: string) =>
      ['content.write', 'content.delete', 'analytics.read'].includes(perm)
    )
    mockFetchVideos.mockResolvedValue({ data: videos, totalCount: videos.length })
    mockFetchCategories.mockResolvedValue(categories)
    mockFetchDisciplines.mockResolvedValue(disciplines)
    mockDeleteVideo.mockResolvedValue({ success: true })

    createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url')
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    // JSDOM: HTMLAnchorElement.click for download
    HTMLAnchorElement.prototype.click = vi.fn()
  })

  afterEach(() => {
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
    confirmSpy.mockRestore()
  })

  it('renders library from mocked video data', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Video Library' })).toBeInTheDocument()
    expect(await screen.findByText('Guard Pass Fundamentals')).toBeInTheDocument()
    expect(screen.getByText('Mount Escape Drill')).toBeInTheDocument()
    expect(screen.getByText('Armbar Setup')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockFetchVideos).toHaveBeenCalled()
    })

    // Stats reflect mocked totals
    expect(screen.getByRole('heading', { name: 'Total Videos' })).toBeInTheDocument()
  })

  it('narrows the list when search filter changes', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Guard Pass Fundamentals')

    const search = screen.getByPlaceholderText('Search videos...')
    await user.clear(search)
    await user.type(search, 'Mount Escape')

    await waitFor(() => {
      expect(screen.getByText('Mount Escape Drill')).toBeInTheDocument()
      expect(screen.queryByText('Guard Pass Fundamentals')).not.toBeInTheDocument()
      expect(screen.queryByText('Armbar Setup')).not.toBeInTheDocument()
    })
  })

  it('exports CSV via Blob and URL.createObjectURL', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Guard Pass Fundamentals')

    await user.click(screen.getByRole('button', { name: /Export/i }))

    expect(createObjectURLSpy).toHaveBeenCalled()
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toBe('text/csv')

    const csvText = await blobArg.text()
    const lines = csvText.split('\n')
    expect(lines[0]).toBe('Title,Category,Instructor,Status,Tier,Upload Date,Views')
    expect(lines).toContain(
      '"Guard Pass Fundamentals","Fundamentals","","ready","tier1","2024-05-01T00:00:00.000Z","100"'
    )
    expect(lines).toContain(
      '"Mount Escape Drill","Escapes","","processing","tier2","2024-04-01T00:00:00.000Z","50"'
    )
    expect(lines).toContain(
      '"Armbar Setup","Fundamentals","","ready","tier1","2024-03-01T00:00:00.000Z","25"'
    )
    expect(csvText).not.toContain('undefined')

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('delete mutation calls deleteVideo and toasts success', async () => {
    const user = userEvent.setup()
    mockDeleteVideo.mockResolvedValue({ success: true })
    renderPage()

    await screen.findByText('Guard Pass Fundamentals')

    const row = screen.getByText('Guard Pass Fundamentals').closest('tr')
    expect(row).toBeTruthy()
    const actionsButton = within(row as HTMLElement).getByRole('button')
    await user.click(actionsButton)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Video' }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(mockDeleteVideo).toHaveBeenCalledWith('vid-1')
    })
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Video deleted successfully')
    })
  })

  it('delete mutation toasts error when deleteVideo fails', async () => {
    const user = userEvent.setup()
    mockDeleteVideo.mockRejectedValue(new Error('Network failure'))
    renderPage()

    await screen.findByText('Guard Pass Fundamentals')

    const row = screen.getByText('Guard Pass Fundamentals').closest('tr')
    expect(row).toBeTruthy()
    const actionsButton = within(row as HTMLElement).getByRole('button')
    await user.click(actionsButton)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Video' }))

    await waitFor(() => {
      expect(mockDeleteVideo).toHaveBeenCalledWith('vid-1')
    })
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to delete video',
        expect.objectContaining({ description: 'Network failure' })
      )
    })
  })
})
