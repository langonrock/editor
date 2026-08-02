import { describe, expect, test } from 'bun:test'

import { buildTree, findByConceptId } from '../../src/tree/tree.ts'

import type { SourceEntry } from 'langonrock/client'

const entry = (bundle: string, path: string, id?: string): SourceEntry => ({
  bundle,
  path,
  bytes: 10,
  hash: 'h',
  ...(id === undefined ? {} : { id })
})

const ENTRIES = [
  entry('sales', 'tables/orders.md', 'orders'),
  entry('sales', 'tables/customers.md', 'customers'),
  entry('sales', 'index.md'),
  entry('sales', 'metrics/revenue.md', 'revenue'),
  entry('ops', 'runbooks/deploy.md', 'deploy')
]

describe('buildTree', () => {
  test('groups by bundle, sorted', () => {
    expect(buildTree(ENTRIES).map(node => node.name)).toEqual(['ops', 'sales'])
  })

  test('nests folders and puts them before loose files', () => {
    const sales = buildTree(ENTRIES)[1]

    expect(sales?.children.map(node => `${node.kind}:${node.name}`)).toEqual([
      'folder:metrics',
      'folder:tables',
      'file:index.md'
    ])
  })

  test('carries the id, which is what a graph click needs to open a file', () => {
    const tables = buildTree(ENTRIES)[1]?.children[1]

    expect(tables?.children.map(node => [node.name, node.id])).toEqual([
      ['customers.md', 'customers'],
      ['orders.md', 'orders']
    ])
  })

  test('shows a navigation file as an ordinary file rather than hiding it', () => {
    const navigation = buildTree(ENTRIES)[1]?.children[2]

    expect(navigation?.kind).toBe('file')
    expect(navigation?.id).toBeUndefined()
  })

  test('gives every node the bundle-relative path a write needs', () => {
    const orders = buildTree(ENTRIES)[1]?.children[1]?.children[1]

    expect(orders?.path).toBe('tables/orders.md')
    expect(orders?.bundle).toBe('sales')
  })

  test('handles deeply nested paths without losing a level', () => {
    const roots = buildTree([entry('a', 'x/y/z/deep.md', 'deep')])
    const deep = roots[0]?.children[0]?.children[0]?.children[0]?.children[0]

    expect(deep?.name).toBe('deep.md')
    expect(deep?.path).toBe('x/y/z/deep.md')
  })

  test('is empty for an empty listing', () => {
    expect(buildTree([])).toEqual([])
  })
})

describe('findByConceptId', () => {
  test('finds a concept nested at any depth', () => {
    expect(findByConceptId(buildTree(ENTRIES), 'revenue')?.path).toBe(
      'metrics/revenue.md'
    )
  })

  test('is undefined for an id that is not in the tree', () => {
    expect(findByConceptId(buildTree(ENTRIES), 'nope')).toBeUndefined()
  })
})
