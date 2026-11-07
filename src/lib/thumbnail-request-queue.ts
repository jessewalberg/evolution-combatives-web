// Leave room in the shared API rate-limit bucket for other dashboard requests.
const INTERVAL_MS = 1500

interface PendingRequest {
    start: () => void
    signal: AbortSignal
    cancel: () => void
}

const pending: PendingRequest[] = []
let nextStart = 0
let timer: ReturnType<typeof setTimeout> | undefined

function schedule(): void {
    if (timer || pending.length === 0) return
    timer = setTimeout(() => {
        timer = undefined
        const item = pending.shift()
        if (!item) return
        item.signal.removeEventListener('abort', item.cancel)
        nextStart = Date.now() + INTERVAL_MS
        item.start()
        schedule()
    }, Math.max(0, nextStart - Date.now()))
}

export function queueThumbnailRequest<T>(signal: AbortSignal, request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException('Request cancelled', 'AbortError'))
            return
        }
        const item: PendingRequest = {
            signal,
            start: () => { request().then(resolve, reject) },
            cancel: () => {
                const index = pending.indexOf(item)
                if (index !== -1) pending.splice(index, 1)
                reject(new DOMException('Request cancelled', 'AbortError'))
            },
        }
        signal.addEventListener('abort', item.cancel, { once: true })
        pending.push(item)
        schedule()
    })
}
