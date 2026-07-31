import type { Connection } from 'langonrock/client'

const INTERVAL_MS = 5_000

export interface PollerOptions {
  intervalMs?: number
  onChange: (snapshot: string) => void
  onError?: (error: unknown) => void
}

export interface Poller {
  stop: () => void
}

/**
 * The server has no push channel, so noticing that someone edited the same
 * folder in Obsidian means asking. `snapshot` is a tiny JSON response and is
 * the right thing to ask: `listSource` reads and hashes every file on every
 * call, which would turn a background poll into real work on a large corpus.
 *
 * The chain is timeouts rather than an interval so a slow response delays the
 * next poll instead of stacking requests behind it.
 */
export function createSnapshotPoller(
  knowledge: Pick<Connection, 'snapshot'>,
  options: PollerOptions
): Poller {
  let timer: ReturnType<typeof setTimeout> | undefined
  let seen: string | undefined
  let stopped = false

  const tick = async (): Promise<void> => {
    try {
      const snapshot = await knowledge.snapshot()

      if (seen !== undefined && snapshot !== seen) {
        options.onChange(snapshot)
      }

      seen = snapshot
    } catch (cause) {
      options.onError?.(cause)
    }

    if (!stopped) {
      timer = setTimeout(() => void tick(), options.intervalMs ?? INTERVAL_MS)
    }
  }

  void tick()

  return {
    stop: () => {
      stopped = true
      clearTimeout(timer)
    }
  }
}
