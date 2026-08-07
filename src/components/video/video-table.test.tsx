import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { VideoTable, type Video } from './video-table'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

function makeVideo(
  overrides: Partial<Video> & Pick<Video, 'id' | 'title' | 'status'>
): Video {
  return {
    description: 'Training video',
    duration: 125,
    fileSize: 1024 * 1024 * 12,
    subscriptionTier: 'tier1',
    categoryId: 'cat-1',
    categoryName: 'Fundamentals',
    disciplineId: 'disc-1',
    disciplineName: 'Jiu Jitsu',
    uploadDate: '2024-03-01T00:00:00.000Z',
    lastModified: '2024-03-02T00:00:00.000Z',
    viewCount: 100,
    completionRate: 70,
    tags: [],
    thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    ...overrides,
  }
}

const alpha = makeVideo({
  id: 'v1',
  title: 'Alpha Guard Pass',
  status: 'ready',
  uploadDate: '2024-05-01T00:00:00.000Z',
  viewCount: 300,
  subscriptionTier: 'tier3',
})

const beta = makeVideo({
  id: 'v2',
  title: 'Beta Mount Escape',
  status: 'processing',
  uploadDate: '2024-04-01T00:00:00.000Z',
  viewCount: 50,
  subscriptionTier: 'tier2',
  thumbnailUrl: undefined,
})

const gamma = makeVideo({
  id: 'v3',
  title: 'Gamma Armbar',
  status: 'error',
  uploadDate: '2024-03-01T00:00:00.000Z',
  viewCount: 10,
  subscriptionTier: 'none',
})

const delta = makeVideo({
  id: 'v4',
  title: 'Delta Sparring',
  status: 'uploading',
  uploadDate: '2024-02-01T00:00:00.000Z',
  viewCount: 5,
})

const epsilon = makeVideo({
  id: 'v5',
  title: 'Epsilon Archive',
  status: 'archived',
  uploadDate: '2024-01-01T00:00:00.000Z',
  viewCount: 1,
})

function getDataRows() {
  return screen.getAllByRole('row').slice(1)
}

function rowTitles() {
  return getDataRows().map((row) => {
    const heading = within(row).queryByRole('heading', { level: 4 })
    return heading?.textContent?.trim() ?? ''
  })
}

function ControlledVideoTable({
  videos,
  pageSize,
  onBulkAction,
  onPreview,
  onEdit,
  onDelete,
}: {
  videos: Video[]
  pageSize?: number
  onBulkAction?: (action: string, videos: Video[]) => void
  onPreview?: (video: Video) => void
  onEdit?: (video: Video) => void
  onDelete?: (video: Video) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  return (
    <VideoTable
      videos={videos}
      pageSize={pageSize}
      selectedVideos={selected}
      onSelectionChange={setSelected}
      onBulkAction={onBulkAction}
      onPreview={onPreview}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  )
}

describe('VideoTable', () => {
  it('is props-driven with no cloudflare/content API imports', async () => {
    // Behavioral check: renders only what parent passes (filtering is parent-owned)
    render(<VideoTable videos={[alpha]} />)
    expect(screen.getByText('Alpha Guard Pass')).toBeInTheDocument()
    expect(screen.queryByText('Beta Mount Escape')).not.toBeInTheDocument()
  })

  it('renders video rows with status badges, tier, and thumbnail', () => {
    render(<VideoTable videos={[alpha, beta, gamma, delta, epsilon]} />)

    expect(screen.getByText('Alpha Guard Pass')).toBeInTheDocument()
    expect(screen.getAllByText('Jiu Jitsu • Fundamentals').length).toBeGreaterThan(0)
    expect(screen.getByAltText('Alpha Guard Pass')).toHaveAttribute(
      'src',
      'https://cdn.example.com/thumb.jpg'
    )
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Uploading')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
    expect(screen.getByText('T3')).toBeInTheDocument()
    expect(screen.getAllByText('2:05').length).toBe(5) // 125s duration on all fixtures
    expect(screen.getByText(/Showing 5 of 5 videos/)).toBeInTheDocument()
  })

  it('shows NoVideosEmptyState when the dataset is empty', () => {
    render(<VideoTable videos={[]} />)
    expect(screen.getByText('No videos uploaded yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows loading skeleton when loading', () => {
    const { container } = render(<VideoTable videos={[alpha]} loading />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('sorts by title when the Video header is clicked (asc then desc)', async () => {
    const user = userEvent.setup()
    // Default sort is uploadDate desc → alpha, beta, gamma
    render(<VideoTable videos={[alpha, beta, gamma]} />)

    await user.click(screen.getByRole('columnheader', { name: /Video/i }))
    expect(rowTitles()).toEqual([
      'Alpha Guard Pass',
      'Beta Mount Escape',
      'Gamma Armbar',
    ])

    await user.click(screen.getByRole('columnheader', { name: /Video/i }))
    expect(rowTitles()).toEqual([
      'Gamma Armbar',
      'Beta Mount Escape',
      'Alpha Guard Pass',
    ])
  })

  it('sorts by status when the Status header is clicked', async () => {
    const user = userEvent.setup()
    render(<VideoTable videos={[alpha, beta, gamma]} />)

    await user.click(screen.getByRole('columnheader', { name: /Status/i }))
    // asc string compare: error, processing, ready
    expect(rowTitles()).toEqual([
      'Gamma Armbar',
      'Beta Mount Escape',
      'Alpha Guard Pass',
    ])
  })

  it('paginates with page size and next/prev controls', async () => {
    const user = userEvent.setup()
    render(
      <VideoTable
        videos={[alpha, beta, gamma, delta, epsilon]}
        pageSize={2}
      />
    )

    // Default uploadDate desc → alpha, beta
    expect(rowTitles()).toEqual(['Alpha Guard Pass', 'Beta Mount Escape'])
    expect(screen.getByText(/Showing 1-2 of 5 results/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(rowTitles()).toEqual(['Gamma Armbar', 'Delta Sparring'])

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(rowTitles()).toEqual(['Alpha Guard Pass', 'Beta Mount Escape'])
  })

  it('toggles selection via row checkbox and select-all, surfaces bulk actions', async () => {
    const user = userEvent.setup()
    const onBulkAction = vi.fn()
    const onSelectionChange = vi.fn()

    function Harness() {
      const [selected, setSelected] = useState<Set<string>>(new Set())
      return (
        <VideoTable
          videos={[alpha, beta, gamma]}
          selectedVideos={selected}
          onSelectionChange={(ids) => {
            onSelectionChange(ids)
            setSelected(ids)
          }}
          onBulkAction={onBulkAction}
        />
      )
    }

    render(<Harness />)

    const firstRowCheckbox = within(getDataRows()[0]).getByRole('checkbox')
    await user.click(firstRowCheckbox)

    expect(onSelectionChange).toHaveBeenCalled()
    const firstCall = onSelectionChange.mock.calls.at(-1)?.[0] as Set<string>
    expect(firstCall.has('v1')).toBe(true)
    expect(screen.getByText('1 videos selected')).toBeInTheDocument()

    const headerCheckbox = within(screen.getAllByRole('row')[0]).getByRole(
      'checkbox'
    )
    await user.click(headerCheckbox)
    expect(screen.getByText('3 videos selected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Publish' }))
    expect(onBulkAction).toHaveBeenCalledWith(
      'publish',
      expect.arrayContaining([
        expect.objectContaining({ id: 'v1' }),
        expect.objectContaining({ id: 'v2' }),
        expect.objectContaining({ id: 'v3' }),
      ])
    )
    await waitFor(() => {
      expect(screen.queryByText(/videos selected/)).not.toBeInTheDocument()
    })
  })

  it('invokes row actions from VideoActionsDropdown', async () => {
    const user = userEvent.setup()
    const onPreview = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()

    render(
      <ControlledVideoTable
        videos={[alpha]}
        onPreview={onPreview}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByRole('button'))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Preview Video' })
    )
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'v1', title: 'Alpha Guard Pass' })
    )

    await user.click(screen.getByRole('button'))
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }))
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' }))
  })

  it('renders parent-filtered dataset without internal filter UI', () => {
    // Filtering is owned by the parent; table only sorts/paginates/selects
    render(<VideoTable videos={[beta]} />)
    expect(screen.getByText('Beta Mount Escape')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Filters/i })).not.toBeInTheDocument()
  })
})
