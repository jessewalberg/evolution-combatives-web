import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-client'

const {
  mockGetUploadUrl,
  mockUploadVideo,
  mockCreateVideo,
  mockAddProcessingVideo,
  mockInvalidateQueries,
} = vi.hoisted(() => ({
  mockGetUploadUrl: vi.fn(),
  mockUploadVideo: vi.fn(),
  mockCreateVideo: vi.fn(),
  mockAddProcessingVideo: vi.fn(),
  mockInvalidateQueries: vi.fn(),
}))

vi.mock('next/image', async () => {
  const { createNextImageMock } = await import('@/test/mocks/next-image')
  return createNextImageMock()
})

vi.mock('../../lib/cloudflare-api', () => ({
  cloudflareApi: {
    getUploadUrl: (...args: unknown[]) => mockGetUploadUrl(...args),
    uploadVideo: (...args: unknown[]) => mockUploadVideo(...args),
  },
}))

vi.mock('../../lib/content-api', () => ({
  contentApi: {
    createVideo: (...args: unknown[]) => mockCreateVideo(...args),
  },
}))

vi.mock('../../services/video-processing-service', () => ({
  videoProcessingService: {
    addProcessingVideo: (...args: unknown[]) => mockAddProcessingVideo(...args),
  },
}))

// Spy invalidateQueries via a shared QueryClient factory
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  )
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  }
})

import { VideoUploadForm } from './video-upload-form'

const disciplines = [
  { id: 'disc-1', name: 'Jiu Jitsu' },
  { id: 'disc-2', name: 'Wrestling' },
]

const categories = [
  { id: 'cat-1', name: 'Fundamentals', disciplineId: 'disc-1' },
  { id: 'cat-2', name: 'Takedowns', disciplineId: 'disc-2' },
]

function renderForm(
  props: Partial<React.ComponentProps<typeof VideoUploadForm>> = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <VideoUploadForm
        disciplines={disciplines}
        categories={categories}
        {...props}
      />
    </QueryClientProvider>
  )
}

function makeVideoFile(
  name = 'training.mp4',
  type = 'video/mp4',
  sizeBytes = 1024
) {
  const file = new File(['video-bytes'], name, { type })
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

/**
 * jsdom never fires video loadedmetadata/seeked/error for blob URLs, so
 * generateThumbnail would hang forever. Force an immediate error so the
 * component's catch path runs and the upload queue still updates.
 */
function stubVideoThumbnailFailure() {
  URL.createObjectURL = vi.fn(() => 'blob:mock-video')
  URL.revokeObjectURL = vi.fn()

  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    set(this: HTMLMediaElement, value: string) {
      this.setAttribute('src', value)
      queueMicrotask(() => {
        const handler = (this as HTMLVideoElement).onerror
        if (typeof handler === 'function') {
          handler.call(this, new Event('error') as unknown as Event)
        }
        this.dispatchEvent(new Event('error'))
      })
    },
    get(this: HTMLMediaElement) {
      return this.getAttribute('src') ?? ''
    },
  })
}

async function selectFile(file: File) {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement
  expect(input).toBeTruthy()
  // applyAccept: false so reject-mime tests reach onChange (accept="video/*")
  await userEvent.upload(input, file, { applyAccept: false })
}

async function selectValidVideo(name = 'training.mp4') {
  await selectFile(makeVideoFile(name))
  expect(await screen.findByText(name)).toBeInTheDocument()
}

async function fillRequiredMetadata() {
  const user = userEvent.setup()
  const disciplineSelect = screen.getByDisplayValue('Select discipline')
  await user.selectOptions(disciplineSelect, 'disc-1')
  const categorySelect = await screen.findByDisplayValue('Select category')
  await user.selectOptions(categorySelect, 'cat-1')
  return user
}

describe('VideoUploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubVideoThumbnailFailure()
    mockGetUploadUrl.mockResolvedValue({
      uploadUrl: 'https://upload.example.com/stream',
      videoId: 'stream-vid-1',
    })
    mockUploadVideo.mockImplementation(
      async (
        _file: File,
        _url: string,
        onProgress?: (progress: number) => void
      ) => {
        onProgress?.(40)
        onProgress?.(100)
      }
    )
    mockCreateVideo.mockResolvedValue({ id: 'db-vid-1' })
  })

  afterEach(() => {
    // keep mock implementations; only clear call history in beforeEach
  })

  it('rejects unsupported mime types via onError', async () => {
    const onError = vi.fn()
    renderForm({ onError })

    await selectFile(makeVideoFile('notes.pdf', 'application/pdf'))

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/Unsupported format/i)
      )
    })
    expect(screen.queryByText(/Upload Queue/)).not.toBeInTheDocument()
  })

  it('rejects oversized files via onError', async () => {
    const onError = vi.fn()
    renderForm({ onError })

    const oversized = makeVideoFile(
      'huge.mp4',
      'video/mp4',
      6 * 1024 * 1024 * 1024
    )
    await selectFile(oversized)

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/File too large/i)
      )
    })
    expect(screen.queryByText(/Upload Queue/)).not.toBeInTheDocument()
  })

  it('accepts a valid video file via the file input', async () => {
    renderForm()
    await selectValidVideo('guard-pass.mp4')

    expect(screen.getByText('Upload Queue (1)')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByDisplayValue('guard-pass')).toBeInTheDocument()
  })

  it('accepts a valid video file via drag-and-drop', async () => {
    renderForm()
    const file = makeVideoFile('drop-me.mp4')
    const dropzone = screen.getByText('Upload Training Videos').closest('div')!

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file], types: ['Files'] },
    })

    expect(await screen.findByText('drop-me.mp4')).toBeInTheDocument()
    expect(screen.getByText('Upload Queue (1)')).toBeInTheDocument()
  })

  it('keeps Start Upload disabled until required metadata is filled', async () => {
    renderForm()
    await selectValidVideo('needs-meta.mp4')

    const startBtn = await screen.findByRole('button', {
      name: /Complete Required Fields/i,
    })
    expect(startBtn).toBeDisabled()

    await fillRequiredMetadata()

    expect(
      await screen.findByRole('button', { name: /Start Upload/i })
    ).toBeEnabled()
  })

  it('uploads successfully: progress UI, success callback, cache invalidation', async () => {
    const onSuccess = vi.fn()
    const onUploadStart = vi.fn()
    const onUploadEnd = vi.fn()
    renderForm({ onSuccess, onUploadStart, onUploadEnd })

    await selectValidVideo('success.mp4')
    await fillRequiredMetadata()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Start Upload/i }))

    await waitFor(() => {
      expect(mockGetUploadUrl).toHaveBeenCalled()
      expect(mockUploadVideo).toHaveBeenCalled()
      expect(mockCreateVideo).toHaveBeenCalled()
      expect(mockAddProcessingVideo).toHaveBeenCalledWith('stream-vid-1')
      expect(onSuccess).toHaveBeenCalledWith('stream-vid-1')
      expect(onUploadStart).toHaveBeenCalled()
      expect(onUploadEnd).toHaveBeenCalled()
    })

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.videos(),
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.videosList(),
    })

    await waitFor(() => {
      expect(screen.getByText('Processing')).toBeInTheDocument()
    })
  })

  it('shows upload progress percentage while uploading', async () => {
    let resolveUpload: (() => void) | undefined
    mockUploadVideo.mockImplementation(
      (
        _file: File,
        _url: string,
        onProgress?: (progress: number) => void
      ) =>
        new Promise<void>((resolve) => {
          onProgress?.(55)
          resolveUpload = resolve
        })
    )

    renderForm()
    await selectValidVideo('progress.mp4')
    await fillRequiredMetadata()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Start Upload/i }))

    await waitFor(() => {
      expect(screen.getByText('Uploading')).toBeInTheDocument()
      expect(screen.getByText(/55%/)).toBeInTheDocument()
    })

    resolveUpload?.()
    await waitFor(() => {
      expect(mockCreateVideo).toHaveBeenCalled()
    })
  })

  it('shows error UI and keeps the form editable when upload fails', async () => {
    const onError = vi.fn()
    mockGetUploadUrl.mockRejectedValue(new Error('Stream unavailable'))

    renderForm({ onError })
    await selectValidVideo('fail.mp4')
    await fillRequiredMetadata()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Start Upload/i }))

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Stream unavailable')).toBeInTheDocument()
      expect(onError).toHaveBeenCalledWith('Stream unavailable')
    })

    // Form remains editable (title input not stuck in loading/disabled complete state)
    const titleInput = screen.getByPlaceholderText('Enter video title')
    expect(titleInput).not.toBeDisabled()
    await user.clear(titleInput)
    await user.type(titleInput, 'Retry Title')
    expect(titleInput).toHaveValue('Retry Title')
  })

  it('reports max files exceeded via onError', async () => {
    const onError = vi.fn()
    renderForm({ onError, maxFiles: 1 })

    await selectValidVideo('one.mp4')

    await selectFile(makeVideoFile('two.mp4'))
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Maximum 1 files allowed')
    })
  })
})
