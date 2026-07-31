import { describe, expect, test } from 'bun:test'

import { createSyncScheduler } from '../../src/connection/sync.ts'

import type { SyncResult } from 'langonrock/client'

const RESULT: SyncResult = {
  snapshot: 'a'.repeat(64),
  concepts: 1,
  bundles: ['sales'],
  diagnostics: []
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function counter(delayMs = 0) {
  let calls = 0

  return {
    calls: () => calls,
    sync: async () => {
      calls += 1
      await wait(delayMs)

      return RESULT
    }
  }
}

describe('createSyncScheduler', () => {
  test('collapses a burst of saves into one compile', async () => {
    const server = counter()
    const scheduler = createSyncScheduler(server, { debounceMs: 10 })

    scheduler.request()
    scheduler.request()
    scheduler.request()

    await wait(40)
    scheduler.close()

    expect(server.calls()).toBe(1)
  })

  test('reports the result, which is how the lint panel is fed', async () => {
    const results: SyncResult[] = []
    const scheduler = createSyncScheduler(counter(), {
      debounceMs: 5,
      onResult: result => results.push(result)
    })

    scheduler.request()
    await wait(30)
    scheduler.close()

    expect(results).toEqual([RESULT])
  })

  test('runs again for a save that landed mid-compile', async () => {
    const server = counter(30)
    const scheduler = createSyncScheduler(server, { debounceMs: 5 })

    scheduler.request()
    await wait(20)
    scheduler.request()
    await wait(80)
    scheduler.close()

    expect(server.calls()).toBe(2)
  })

  test('reports an error without stopping the scheduler', async () => {
    const errors: unknown[] = []
    let calls = 0
    const scheduler = createSyncScheduler(
      {
        sync: () => {
          calls += 1

          return Promise.reject(new Error('compile failed'))
        }
      },
      { debounceMs: 5, onError: error => errors.push(error) }
    )

    scheduler.request()
    await wait(25)
    scheduler.request()
    await wait(25)
    scheduler.close()

    expect(calls).toBe(2)
    expect(errors).toHaveLength(2)
  })

  test('close cancels a compile that has not started', async () => {
    const server = counter()
    const scheduler = createSyncScheduler(server, { debounceMs: 20 })

    scheduler.request()
    scheduler.close()
    await wait(50)

    expect(server.calls()).toBe(0)
  })
})
