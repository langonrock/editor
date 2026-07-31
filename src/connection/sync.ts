import type { Connection, SyncResult } from 'langonrock/client'

const DEBOUNCE_MS = 400

export interface SyncOptions {
  debounceMs?: number
  onResult?: (result: SyncResult) => void
  onError?: (error: unknown) => void
}

export interface SyncScheduler {
  request: () => void
  close: () => void
}

/**
 * The server's watcher already recompiles about 200 ms after a file changes, so
 * this is not what makes a write visible. It is what makes the write's effect
 * *knowable*: only an explicit sync guarantees a compile that began after the
 * write, and only its result carries the new digest and the diagnostics the
 * lint panel shows. The debounced watcher can report the previous digest if its
 * compile was already in flight when the write landed.
 *
 * Asking twice is nearly free, because the server coalesces overlapping syncs.
 */
export function createSyncScheduler(
  knowledge: Pick<Connection, 'sync'>,
  options: SyncOptions = {}
): SyncScheduler {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let repeat = false

  const run = async (): Promise<void> => {
    if (running) {
      repeat = true

      return
    }

    running = true

    try {
      // Not `options.onResult?.(await knowledge.sync())`. An optional call
      // short-circuits before evaluating its arguments, so with no listener
      // attached the sync would never be issued at all.
      const result = await knowledge.sync()

      options.onResult?.(result)
    } catch (cause) {
      options.onError?.(cause)
    } finally {
      running = false
    }

    if (repeat) {
      repeat = false
      await run()
    }
  }

  return {
    request: () => {
      clearTimeout(timer)
      timer = setTimeout(() => void run(), options.debounceMs ?? DEBOUNCE_MS)
    },
    close: () => clearTimeout(timer)
  }
}
