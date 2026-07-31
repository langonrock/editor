import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { classify } from '../../src/connection/errors.ts'
import { openSession } from '../../src/connection/session.ts'
import { startStore } from './harness.ts'

import type { Store } from './harness.ts'

describe('a store configured for writing', () => {
  let store: Store

  beforeAll(async () => {
    store = await startStore()
  })

  afterAll(() => store.stop())

  test('opens writable and lists the seeded concept', async () => {
    const session = await openSession(store.dsn)

    expect(session.access).toBe('writable')
    expect(session.entries.map(e => e.path)).toContain('tables/orders.md')
    await session.close()
  })
})

describe('a store with no source directory', () => {
  let store: Store

  beforeAll(async () => {
    store = await startStore({ sources: false })
  })

  afterAll(() => store.stop())

  test('opens read only rather than failing to open', async () => {
    const session = await openSession(store.dsn)

    expect(session.access).toBe('read-only')
    expect(session.entries).toEqual([])
    await session.close()
  })
})

describe('a token that may read but not write', () => {
  let store: Store

  beforeAll(async () => {
    store = await startStore({ write: false })
  })

  afterAll(() => store.stop())

  // The listing route never checks writability, so this state is invisible
  // until the first save. The session reports the store, not the token.
  test('opens writable, because the listing does not reveal the grant', async () => {
    const session = await openSession(store.dsn)

    expect(session.access).toBe('writable')
    await session.close()
  })

  test('reveals itself only when a write is attempted', async () => {
    const session = await openSession(store.dsn)

    try {
      await session.knowledge.writeSource(
        'sales',
        'new.md',
        '---\ntype: X\n---\n'
      )
      throw new Error('the write should have been refused')
    } catch (cause) {
      expect(classify(cause).kind).toBe('read-only-token')
    }

    await session.close()
  })
})

describe('the transport policy, end to end', () => {
  test('refuses a clear-text token to a remote host before connecting', () => {
    expect(openSession('okf+http://kb.example.com?token=s')).rejects.toThrow(
      'refusing to send a token in clear text'
    )
  })
})
