import { describe, expect, test } from 'bun:test'

import {
  composeConcept,
  hasFrontmatter,
  parseFrontmatter,
  updateFrontmatter
} from '../../src/okf/frontmatter.ts'

// Copied from langonrock's test/fixtures/sales/tables/orders.md. It exercises
// every frontmatter shape the compiler cares about at once: a scalar, a flow
// sequence, a nested mapping list and a date.
const ORDERS = `---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
grain: order_id
tags: [sales, revenue]
sources:
  - url: https://wiki.acme.test/orders
    trust: high
verified: 2026-07-01
status: current
---

Joined with [customers](./customers.md) and [payments](./payments.md).
`

describe('hasFrontmatter', () => {
  test('is what separates a concept from repository furniture', () => {
    expect(hasFrontmatter(ORDERS)).toBe(true)
    expect(hasFrontmatter('# README\n\nNot a concept.\n')).toBe(false)
  })

  test('requires the delimiter at the very start of the file', () => {
    expect(hasFrontmatter('\n---\ntype: Table\n---\n')).toBe(false)
  })
})

describe('parseFrontmatter', () => {
  test('reads the fields the compiler keeps', () => {
    const { data, error } = parseFrontmatter(ORDERS)

    expect(error).toBeUndefined()
    expect(data.type).toBe('BigQuery Table')
    expect(data.grain).toBe('order_id')
    expect(data.status).toBe('current')
    expect(data.tags).toEqual(['sales', 'revenue'])
  })

  test('keeps the body starting at its own blank line', () => {
    expect(parseFrontmatter(ORDERS).body).toBe(
      '\nJoined with [customers](./customers.md) and [payments](./payments.md).\n'
    )
  })

  test('treats a file with no frontmatter as all body', () => {
    const source = '# README\n\nNot a concept.\n'

    expect(parseFrontmatter(source)).toEqual({ data: {}, body: source })
  })

  test('reports invalid yaml instead of throwing', () => {
    const { data, error } = parseFrontmatter('---\ntype: [unclosed\n---\n\nx\n')

    expect(data).toEqual({})
    expect(error).toStartWith('invalid YAML frontmatter:')
  })

  test('reports frontmatter that is not a mapping', () => {
    const { error } = parseFrontmatter('---\n- one\n- two\n---\n\nx\n')

    expect(error).toBe('frontmatter is not a mapping')
  })
})

describe('agreement with the compiler', () => {
  // The whole module rests on the `yaml` package reading a document the same
  // way `Bun.YAML.parse` does, since the server compiles what the editor shows.
  // Both claim YAML 1.2; this is the test that says so out loud.
  test.each([
    ['the full fixture', ORDERS],
    ['a norway-problem boolean', '---\ntype: Table\narchived: no\n---\n\nx\n'],
    ['a sexagesimal-looking scalar', '---\ntype: Table\nid: 12:30\n---\n\nx\n'],
    ['a leading-zero number', '---\ntype: Table\ncode: 0755\n---\n\nx\n'],
    ['an unquoted date', '---\ntype: Table\nverified: 2026-07-01\n---\n\nx\n']
  ])('parses %s exactly as Bun.YAML does', (_name, source) => {
    const raw = source.slice(4, source.indexOf('\n---\n', 3) + 1)

    expect(parseFrontmatter(source).data).toEqual(
      Bun.YAML.parse(raw) as Record<string, unknown>
    )
  })
})

describe('composeConcept', () => {
  test('is the exact inverse of parseFrontmatter', () => {
    const { data, body } = parseFrontmatter(ORDERS)
    const { data: again, body: bodyAgain } = parseFrontmatter(
      composeConcept(data, body)
    )

    expect(again).toEqual(data)
    expect(bodyAgain).toBe(body)
  })

  test('does not insert a blank line the body already carries', () => {
    expect(composeConcept({ type: 'Table' }, '\nBody.\n')).toBe(
      '---\ntype: Table\n---\n\nBody.\n'
    )
  })
})

describe('updateFrontmatter', () => {
  test('changes one key and leaves every other byte alone', () => {
    const updated = updateFrontmatter(ORDERS, { status: 'deprecated' })

    expect(updated).toBe(
      ORDERS.replace('status: current', 'status: deprecated')
    )
  })

  test('preserves nested structure and key order when adding a key', () => {
    const updated = updateFrontmatter(ORDERS, { owner: 'analytics' })
    const { data } = parseFrontmatter(updated)

    expect(updated).toContain('  - url: https://wiki.acme.test/orders')
    expect(updated).toContain('tags: [sales, revenue]')
    expect(Object.keys(data).at(-1)).toBe('owner')
    expect(data.sources).toEqual([
      { url: 'https://wiki.acme.test/orders', trust: 'high' }
    ])
  })

  test('removes a key set to undefined', () => {
    const updated = updateFrontmatter(ORDERS, { title: undefined })

    expect(parseFrontmatter(updated).data).not.toHaveProperty('title')
    expect(updated).not.toContain('title:')
  })

  test('gives a file with no frontmatter one, keeping it as the body', () => {
    const updated = updateFrontmatter('# README\n', { type: 'Note' })

    expect(updated).toBe('---\ntype: Note\n---\n# README\n')
  })

  test('leaves the body untouched', () => {
    const updated = updateFrontmatter(ORDERS, { grain: 'order_id_v2' })

    expect(parseFrontmatter(updated).body).toBe(parseFrontmatter(ORDERS).body)
  })

  test('does not rewrap a description longer than the default line width', () => {
    const long = `description: ${'word '.repeat(30).trim()}`
    const source = `---\ntype: Table\n${long}\n---\n\nBody.\n`

    expect(updateFrontmatter(source, { status: 'draft' })).toContain(long)
  })
})
