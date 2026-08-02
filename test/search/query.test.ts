import { describe, expect, test } from 'bun:test'

import { isLinkedOnly, parseSearch } from '../../src/search/query.ts'

const RESULT = [
  '# tenant: acme',
  '# query: orders revenue',
  '# hits: 2 direct, 1 linked',
  'id\tbundle\tkind\tstatus\tgrain\tsummary\tlinks\tpos',
  'orders\tsales\tbigquery_table\t-\torder_id\tOne row per order.\tcustomers\t412',
  'revenue\tsales\tmetric\t-\t-\tNet revenue.\t-\t-',
  'customers\tsales\tbigquery_table\t-\tcustomer_id\tRegistered customers.\t-\t-',
  ''
].join('\n')

describe('parseSearch', () => {
  test('reads the query back, which is what the results header shows', () => {
    expect(parseSearch(RESULT).query).toBe('orders revenue')
  })

  test('separates matches from concepts reached by a link', () => {
    const result = parseSearch(RESULT)

    expect(result.direct).toBe(2)
    expect(result.linked).toBe(1)
    expect(result.rows).toHaveLength(3)
  })

  test('marks only the trailing rows as linked', () => {
    const result = parseSearch(RESULT)

    expect([0, 1, 2].map(i => isLinkedOnly(result, i))).toEqual([
      false,
      false,
      true
    ])
  })

  test('carries the located offset only for hits matched in the body', () => {
    const rows = parseSearch(RESULT).rows

    expect(rows[0]?.pos).toBe(412)
    expect(rows[1]?.pos).toBeUndefined()
    expect(rows[2]?.pos).toBeUndefined()
  })

  test('reads an offset of zero as located rather than absent', () => {
    const top = [
      '# tenant: acme',
      'id\tbundle\tkind\tstatus\tgrain\tsummary\tlinks\tpos',
      'orders\tsales\tbigquery_table\t-\t-\tOne row per order.\t-\t0',
      ''
    ].join('\n')

    expect(parseSearch(top).rows[0]?.pos).toBe(0)
  })

  test('handles a search that matched nothing', () => {
    const empty = [
      '# tenant: acme',
      '# query: nothing',
      '# hits: 0 direct, 0 linked',
      'id\tbundle\tkind\tstatus\tgrain\tsummary\tlinks\tpos',
      ''
    ].join('\n')

    expect(parseSearch(empty).rows).toEqual([])
    expect(parseSearch(empty).direct).toBe(0)
  })

  test('falls back to treating every row as direct when counts are absent', () => {
    const plain = [
      '# tenant: acme',
      'id\tbundle\tkind\tstatus\tgrain\tsummary\tlinks\tpos',
      'orders\tsales\tbigquery_table\t-\t-\tOne row per order.\t-\t-',
      ''
    ].join('\n')
    const result = parseSearch(plain)

    expect(result.direct).toBe(1)
    expect(isLinkedOnly(result, 0)).toBe(false)
  })
})
