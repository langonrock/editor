import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { connect } from 'langonrock/client'

import { parseManifest } from '../../src/okf/manifest.ts'
import { startStore } from './harness.ts'

import type { Connection } from 'langonrock/client'
import type { Store } from './harness.ts'

const REVENUE = `---
type: Metric
description: Net revenue in the period.
grain: day
---

Derived from [orders](../tables/orders.md).
`

let store: Store
let knowledge: Connection

beforeAll(async () => {
  store = await startStore()
  knowledge = connect(store.dsn)
})

afterAll(() => store.stop())

describe('the write cycle the editor depends on', () => {
  test('creating returns the hash a later write must present', async () => {
    const hash = await knowledge.writeSource(
      'sales',
      'metrics/revenue.md',
      REVENUE
    )

    expect(hash).toMatch(/^[0-9a-f]{64}$/)

    const found = await knowledge.readSource('sales', 'metrics/revenue.md')

    expect(found?.content).toBe(REVENUE)
    expect(found?.hash).toBe(hash)
  })

  test('a second create is refused, so nothing is silently overwritten', () => {
    expect(
      knowledge.writeSource('sales', 'metrics/revenue.md', 'x')
    ).rejects.toThrow('412')
  })

  test('a write against a stale hash is refused', () => {
    const stale = '0'.repeat(64)

    expect(
      knowledge.writeSource('sales', 'metrics/revenue.md', 'x', stale)
    ).rejects.toThrow('412')
  })

  test('a write against the current hash succeeds and moves it', async () => {
    const before = await knowledge.readSource('sales', 'metrics/revenue.md')
    const updated = REVENUE.replace('Net revenue', 'Gross revenue')
    const after = await knowledge.writeSource(
      'sales',
      'metrics/revenue.md',
      updated,
      before?.hash
    )

    expect(after).not.toBe(before?.hash)
  })

  test('sync compiles the write into the manifest', async () => {
    const result = await knowledge.sync()

    expect(result.snapshot).toMatch(/^[0-9a-f]{64}$/)

    const ids = parseManifest(await knowledge.manifest()).rows.map(
      row => row.id
    )

    expect(ids).toContain('revenue')
  })

  test('reading a missing concept is undefined, not an error', () => {
    expect(knowledge.readSource('sales', 'nope.md')).resolves.toBeUndefined()
  })
})

describe('the id that joins a file to its manifest row', () => {
  test('a concept carries the id it compiles to', async () => {
    const entries = await knowledge.listSource()
    const revenue = entries.find(e => e.path === 'metrics/revenue.md')

    expect(revenue?.id).toBe('revenue')
    expect(revenue?.bundle).toBe('sales')
  })

  test('plain markdown compiles to a concept like any other file', async () => {
    await knowledge.writeSource('sales', 'README.md', '# No frontmatter\n')
    await knowledge.sync()

    const entries = await knowledge.listSource()

    expect(entries.find(e => e.path === 'README.md')?.id).toBe('README')
  })

  test('a navigation file is the only kind that carries no id', async () => {
    await knowledge.writeSource('sales', 'index.md', '# Navigation\n')
    await knowledge.sync()

    const entries = await knowledge.listSource()

    expect(entries.find(e => e.path === 'index.md')?.id).toBeUndefined()
  })
})

describe('the lint the editor shows', () => {
  test('sync reports a missing type, a broken link and plain markdown', async () => {
    await knowledge.writeSource(
      'sales',
      'metrics/broken.md',
      '---\ndescription: No type here.\n---\n\nSee [gone](./missing.md).\n'
    )

    const messages = (await knowledge.sync()).diagnostics.map(d => d.message)

    expect(messages).toContain('missing required frontmatter field "type"')
    expect(messages.some(m => m.includes('unresolved link'))).toBe(true)
    expect(messages.some(m => m.includes('compiled as plain markdown'))).toBe(
      true
    )
  })
})

describe('deleting', () => {
  test('needs the current hash and then the concept is gone', async () => {
    const found = await knowledge.readSource('sales', 'metrics/broken.md')

    await knowledge.deleteSource(
      'sales',
      'metrics/broken.md',
      found?.hash ?? ''
    )

    expect(
      knowledge.readSource('sales', 'metrics/broken.md')
    ).resolves.toBeUndefined()
  })
})
