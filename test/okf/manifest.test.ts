import { describe, expect, test } from 'bun:test'

import { parseManifest } from '../../src/okf/manifest.ts'

// The shape langonrock's README documents for `langonrock manifest`.
const TENANT = [
  '# tenant: acme',
  '# bundles: ops sales',
  'id\tbundle\tkind\tstatus\tgrain\tsummary\tlinks',
  'deploy\tops\trunbook\t-\t-\tHow to ship the orders service.\t-',
  'customers\tsales\tbigquery_table\tdeprecated\tcustomer_id\tRegistered customers.\t-',
  'orders\tsales\tbigquery_table\t-\torder_id\tOne row per order.\tcustomers metrics/orders',
  ''
].join('\n')

describe('parseManifest', () => {
  test('keeps the comment lines verbatim and in order', () => {
    expect(parseManifest(TENANT).comments).toEqual([
      '# tenant: acme',
      '# bundles: ops sales'
    ])
  })

  test('reads every column by name', () => {
    const [, customers] = parseManifest(TENANT).rows

    expect(customers).toEqual({
      id: 'customers',
      bundle: 'sales',
      kind: 'bigquery_table',
      status: 'deprecated',
      grain: 'customer_id',
      summary: 'Registered customers.',
      links: []
    })
  })

  test('turns the empty cell into an empty string, not a dash', () => {
    const [deploy] = parseManifest(TENANT).rows

    expect(deploy?.status).toBe('')
    expect(deploy?.grain).toBe('')
    expect(deploy?.links).toEqual([])
  })

  test('splits a multi-link cell on spaces', () => {
    const orders = parseManifest(TENANT).rows.at(-1)

    expect(orders?.links).toEqual(['customers', 'metrics/orders'])
  })

  test('reads a bundle manifest that has no bundle column', () => {
    const bundle = [
      '# bundle: sales',
      'id\tkind\tstatus\tgrain\tsummary\tlinks',
      'orders\tbigquery_table\t-\torder_id\tOne row per order.\tcustomers',
      ''
    ].join('\n')
    const [row] = parseManifest(bundle).rows

    expect(row?.id).toBe('orders')
    expect(row?.bundle).toBe('')
    expect(row?.links).toEqual(['customers'])
  })

  test('reads a search result, which adds comments but keeps the header', () => {
    const search = [
      '# tenant: acme',
      '# query: orders',
      '# hits: 1 direct, 0 linked',
      'id\tbundle\tkind\tstatus\tgrain\tsummary\tlinks',
      'orders\tsales\tbigquery_table\t-\torder_id\tOne row per order.\t-',
      ''
    ].join('\n')
    const parsed = parseManifest(search)

    expect(parsed.comments).toHaveLength(3)
    expect(parsed.rows).toHaveLength(1)
  })

  test('refuses a document with no header row', () => {
    expect(() => parseManifest('# tenant: acme\n')).toThrow(
      'manifest has no header row'
    )
  })
})
