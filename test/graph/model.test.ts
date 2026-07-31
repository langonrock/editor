import { describe, expect, test } from 'bun:test'

import { neighborhood, toGraph } from '../../src/graph/model.ts'

import type { ManifestRow } from '../../src/okf/types.ts'

const row = (id: string, links: string[] = []): ManifestRow => ({
  id,
  bundle: 'sales',
  kind: 'bigquery_table',
  status: '',
  grain: '',
  summary: `about ${id}`,
  links
})

const ROWS = [
  row('orders', ['customers', 'revenue']),
  row('customers'),
  row('revenue', ['orders']),
  row('lonely')
]

describe('toGraph', () => {
  test('keeps every row as a node, including one with no links', () => {
    expect(toGraph(ROWS).nodes.map(node => node.id)).toEqual([
      'orders',
      'customers',
      'revenue',
      'lonely'
    ])
  })

  test('builds one edge per link', () => {
    expect(toGraph(ROWS).edges).toEqual([
      { source: 'orders', target: 'customers' },
      { source: 'orders', target: 'revenue' },
      { source: 'revenue', target: 'orders' }
    ])
  })

  test('counts degree in both directions', () => {
    const byId = new Map(
      toGraph(ROWS).nodes.map(node => [node.id, node.degree])
    )

    expect(byId.get('orders')).toBe(3)
    expect(byId.get('customers')).toBe(1)
    expect(byId.get('lonely')).toBe(0)
  })

  test('drops an edge to an id the manifest does not contain', () => {
    const graph = toGraph([row('orders', ['ghost'])])

    expect(graph.edges).toEqual([])
    expect(graph.nodes[0]?.degree).toBe(0)
  })
})

describe('neighborhood', () => {
  test('depth zero is the node alone', () => {
    expect(neighborhood(toGraph(ROWS), 'orders', 0).nodes).toHaveLength(1)
  })

  test('depth one follows links in both directions', () => {
    const near = neighborhood(toGraph(ROWS), 'customers', 1)

    // customers is only ever a target, so an outbound-only walk would miss orders.
    expect(near.nodes.map(node => node.id).sort()).toEqual([
      'customers',
      'orders'
    ])
  })

  test('depth two reaches a concept two hops away', () => {
    const near = neighborhood(toGraph(ROWS), 'customers', 2)

    expect(near.nodes.map(node => node.id).sort()).toEqual([
      'customers',
      'orders',
      'revenue'
    ])
  })

  test('never reaches an unconnected concept', () => {
    const near = neighborhood(toGraph(ROWS), 'orders', 5)

    expect(near.nodes.map(node => node.id)).not.toContain('lonely')
  })

  test('keeps only edges whose both ends survived', () => {
    const near = neighborhood(toGraph(ROWS), 'customers', 1)

    expect(near.edges).toEqual([{ source: 'orders', target: 'customers' }])
  })
})
