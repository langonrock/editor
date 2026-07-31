import { describe, expect, test } from 'bun:test'

import { newDocument, openDocument } from '../../src/editor/document.ts'
import { saveDocument } from '../../src/editor/save.ts'

import type { FailureKind } from '../../src/connection/errors.ts'
import type { SaveTarget } from '../../src/editor/save.ts'

const served = (status: number, body: string) =>
  new Error(`langonrock server returned ${status}: ${body}`)

function target(overrides: Partial<SaveTarget> = {}): SaveTarget {
  return {
    writeSource: () => Promise.resolve('newhash'),
    readSource: () => Promise.resolve(undefined),
    ...overrides
  }
}

const opened = () =>
  openDocument('sales', 'tables/orders.md', { content: 'x\n', hash: 'base' })

describe('saveDocument', () => {
  test('presents the hash it opened with, so the server can refuse a stale write', async () => {
    const seen: unknown[] = []
    const outcome = await saveDocument(
      target({
        writeSource: (bundle, path, content, replaces) => {
          seen.push([bundle, path, content, replaces])

          return Promise.resolve('h2')
        }
      }),
      opened()
    )

    expect(seen).toEqual([['sales', 'tables/orders.md', 'x\n', 'base']])
    expect(outcome).toEqual({ kind: 'saved', hash: 'h2' })
  })

  test('sends no hash for a new file, which the client turns into a create', async () => {
    let replaces: string | undefined = 'unset'
    const document = newDocument('sales', 'new.md', '---\ntype: X\n---\n')

    await saveDocument(
      target({
        writeSource: (_b, _p, _c, given) => {
          replaces = given

          return Promise.resolve('h1')
        }
      }),
      document
    )

    expect(replaces).toBeUndefined()
  })

  test('fetches the winning version on a conflict, rather than only reporting one', async () => {
    const outcome = await saveDocument(
      target({
        writeSource: () =>
          Promise.reject(served(412, 'concept changed since it was read')),
        readSource: () =>
          Promise.resolve({ content: 'theirs\n', hash: 'fresh' })
      }),
      opened()
    )

    expect(outcome).toEqual({
      kind: 'conflict',
      theirs: 'theirs\n',
      theirHash: 'fresh'
    })
  })

  test('a 412 for a file that is now gone is a rejection, not a merge', async () => {
    const outcome = await saveDocument(
      target({
        writeSource: () =>
          Promise.reject(served(412, 'concept does not exist')),
        readSource: () => Promise.resolve(undefined)
      }),
      opened()
    )

    expect(outcome.kind).toBe('rejected')
  })

  test.each([
    [403, 'this token may read but not write', 'read-only-token'],
    [409, 'tenant "acme" has no source directory', 'read-only-store'],
    [401, 'invalid or missing bearer token', 'unauthorized']
  ])('reports %i as a classified rejection', async (status, body, kind) => {
    const outcome = await saveDocument(
      target({ writeSource: () => Promise.reject(served(status, body)) }),
      opened()
    )

    expect(outcome).toEqual({
      kind: 'rejected',
      failure: {
        kind: kind as FailureKind,
        status,
        detail: `langonrock server returned ${status}: ${body}`
      }
    })
  })

  test('refuses an illegal path before spending a round trip', async () => {
    let called = false
    const outcome = await saveDocument(
      target({
        writeSource: () => {
          called = true

          return Promise.resolve('h')
        }
      }),
      openDocument('sales', '../escape.md', { content: 'x', hash: 'h' })
    )

    expect(called).toBe(false)
    expect(outcome.kind).toBe('rejected')
  })

  test('refuses an illegal bundle name before spending a round trip', async () => {
    const outcome = await saveDocument(
      target(),
      openDocument('not a bundle', 'a.md', { content: 'x', hash: 'h' })
    )

    expect(outcome.kind).toBe('rejected')
  })

  test('measures the limit in utf-8 bytes, the way the server does', async () => {
    const justOver = `${'é'.repeat(500_000)}a`
    const outcome = await saveDocument(
      target(),
      openDocument('sales', 'a.md', { content: justOver, hash: 'h' })
    )

    expect(outcome.kind).toBe('rejected')

    if (outcome.kind === 'rejected') {
      expect(outcome.failure.detail).toContain('1000001 bytes')
    }
  })

  test('accepts a document that lands exactly on the limit', async () => {
    const atLimit = 'é'.repeat(500_000)
    const outcome = await saveDocument(
      target(),
      openDocument('sales', 'a.md', { content: atLimit, hash: 'h' })
    )

    expect(outcome.kind).toBe('saved')
  })

  test('restores the original line endings on the way out', async () => {
    let written = ''
    const document = openDocument('sales', 'a.md', {
      content: 'a\r\nb\r\n',
      hash: 'h'
    })

    await saveDocument(
      target({
        writeSource: (_b, _p, content) => {
          written = content

          return Promise.resolve('h2')
        }
      }),
      document
    )

    expect(written).toBe('a\r\nb\r\n')
  })
})
