/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const checkUploadStatus = vi.fn()
const getVideoDetails = vi.fn()

vi.mock('./cloudflare-stream', () => ({
  cloudflareStreamService: {
    upload: { checkUploadStatus },
    video: { getVideoDetails },
  },
}))

describe('videoProcessingService', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function loadService() {
    // Prevent auto-init from hanging; respond to get-processing
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ processingVideos: [] }),
    })
    const mod = await import('./video-processing-service')
    // Clear any pending auto-start timer and stop if started
    await vi.advanceTimersByTimeAsync(0)
    mod.videoProcessingService.stop()
    // Drain processing set via remove after stop
    for (const id of mod.videoProcessingService.getProcessingVideos()) {
      mod.videoProcessingService.removeProcessingVideo(id)
    }
    mockFetch.mockReset()
    return mod.videoProcessingService
  }

  it('start is no-op when already running and stop clears interval', async () => {
    const svc = await loadService()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    svc.start()
    svc.start() // already running
    expect(log).toHaveBeenCalledWith('Starting video processing service...')

    svc.stop()
    expect(log).toHaveBeenCalledWith('Video processing service stopped')
    log.mockRestore()
  })

  it('add/remove processing videos and check ready/error/still-processing', async () => {
    const svc = await loadService()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    svc.addProcessingVideo('cf-ready')
    svc.addProcessingVideo('cf-error')
    svc.addProcessingVideo('cf-busy')
    expect(svc.getProcessingVideos().size).toBe(3)

    checkUploadStatus
      .mockResolvedValueOnce({ status: 'ready' })
      .mockResolvedValueOnce({ status: 'error', error: 'bad' })
      .mockResolvedValueOnce({ status: 'processing' })

    getVideoDetails.mockResolvedValue({ duration: 95.6 })
    mockFetch.mockResolvedValue({ ok: true, statusText: 'OK' })

    svc.start()
    // immediate check + interval
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()
    await vi.runOnlyPendingTimersAsync()

    expect(getVideoDetails).toHaveBeenCalledWith('cf-ready')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/video-processing/update-status',
      expect.objectContaining({ method: 'POST' })
    )

    // ready + error removed; busy may remain
    expect(svc.getProcessingVideos().has('cf-busy')).toBe(true)
    expect(svc.getProcessingVideos().has('cf-ready')).toBe(false)
    expect(svc.getProcessingVideos().has('cf-error')).toBe(false)

    svc.stop()
    log.mockRestore()
    errorLog.mockRestore()
  })

  it('initializeFromDatabase adds videos and skips non-JSON', async () => {
    const svc = await loadService()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'text/html' },
      json: async () => ({}),
    })
    await svc.initializeFromDatabase()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('non-JSON'))

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        processingVideos: [{ cloudflare_video_id: 'cf-1' }, { cloudflare_video_id: null }],
      }),
    })
    await svc.initializeFromDatabase()
    expect(svc.getProcessingVideos().has('cf-1')).toBe(true)

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    })
    await svc.initializeFromDatabase()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('500'))

    mockFetch.mockRejectedValueOnce(new Error('network'))
    await svc.initializeFromDatabase()

    warn.mockRestore()
    log.mockRestore()
  })

  it('handles check failures without marking error (shouldMarkAsError false)', async () => {
    const svc = await loadService()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    svc.addProcessingVideo('cf-fail')
    checkUploadStatus.mockRejectedValue(new Error('cf down'))
    svc.start()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    await Promise.resolve()

    expect(svc.getProcessingVideos().has('cf-fail')).toBe(true)
    svc.stop()
    errorLog.mockRestore()
  })

  it('skips client-side start/add', async () => {
    vi.stubGlobal('window', {})
    vi.resetModules()
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ processingVideos: [] }),
    })
    const { videoProcessingService } = await import('./video-processing-service')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    videoProcessingService.start()
    videoProcessingService.addProcessingVideo('x')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('server-side'))
    expect(videoProcessingService.getProcessingVideos().size).toBe(0)

    warn.mockRestore()
    log.mockRestore()
    // @ts-expect-error cleanup
    delete globalThis.window
  })
})
