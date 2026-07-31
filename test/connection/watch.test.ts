import { describe, expect, test } from 'bun:test'

import { createSnapshotPoller } from '../../src/connection/watch.ts'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function digests(sequence: string[]) {
  let index = 0

  return {
    calls: () => index,
    snapshot: () => {
      const value = sequence[Math.min(index, sequence.length - 1)] ?? ''

      index += 1

      return Promise.resolve(value)
    }
  }
}

describe('createSnapshotPoller', () => {
  test('says nothing about the digest it first observes', async () => {
    const changes: string[] = []
    const poller = createSnapshotPoller(digests(['a', 'a', 'a']), {
      intervalMs: 5,
      onChange: snapshot => changes.push(snapshot)
    })

    await wait(30)
    poller.stop()

    expect(changes).toEqual([])
  })

  test('reports a digest that moved, which is the obsidian-alongside case', async () => {
    const changes: string[] = []
    const poller = createSnapshotPoller(digests(['a', 'a', 'b', 'b', 'c']), {
      intervalMs: 5,
      onChange: snapshot => changes.push(snapshot)
    })

    await wait(60)
    poller.stop()

    expect(changes).toEqual(['b', 'c'])
  })

  test('keeps polling after a failed request', async () => {
    const errors: unknown[] = []
    let calls = 0
    const poller = createSnapshotPoller(
      {
        snapshot: () => {
          calls += 1

          return calls === 1
            ? Promise.reject(new Error('offline'))
            : Promise.resolve('a')
        }
      },
      { intervalMs: 5, onChange: () => undefined, onError: e => errors.push(e) }
    )

    await wait(40)
    poller.stop()

    expect(errors).toHaveLength(1)
    expect(calls).toBeGreaterThan(1)
  })

  test('stops for good, so a closed connection is never polled', async () => {
    const server = digests(['a', 'b', 'c'])
    const poller = createSnapshotPoller(server, {
      intervalMs: 5,
      onChange: () => undefined
    })

    await wait(20)
    poller.stop()

    const afterStop = server.calls()

    await wait(40)

    expect(server.calls()).toBe(afterStop)
  })
})
