import { describe, expect, test } from 'bun:test'

import {
  formatDelimited,
  parseDelimited,
  sniffDelimiter,
  stripBom
} from '../../src/transfer/csv.ts'
import { exportManifest, manifestToRows } from '../../src/transfer/csvexport.ts'
import { rowsToConcepts } from '../../src/transfer/csvimport.ts'
import { parseFrontmatter } from '../../src/okf/frontmatter.ts'

import type { ManifestRow } from '../../src/okf/types.ts'

describe('stripBom', () => {
  test('removes the marker Excel writes, and nothing else', () => {
    expect(stripBom('﻿bundle,path')).toBe('bundle,path')
    expect(stripBom('bundle,path')).toBe('bundle,path')
  })
})

describe('sniffDelimiter', () => {
  test.each([
    ['bundle,path,type', ','],
    ['bundle\tpath\ttype', '\t'],
    ['bundle;path;type', ';']
  ])('reads %p as %p', (header, expected) => {
    expect(sniffDelimiter(header)).toBe(expected as ',' | '\t' | ';')
  })

  test('is not fooled by a comma inside a quoted cell further down', () => {
    const text = 'bundle;path;summary\na;b.md;"one, two, three"'

    expect(sniffDelimiter(text)).toBe(';')
  })

  test('defaults to comma for a single column', () => {
    expect(sniffDelimiter('path')).toBe(',')
  })
})

describe('parseDelimited', () => {
  test('honours quoting, including an embedded newline', () => {
    const text = 'bundle,path,body\nsales,a.md,"line one\nline two"'

    expect(parseDelimited(text)[0]?.body).toBe('line one\nline two')
  })

  test('reads a bom-prefixed tab file, which is what Excel exports', () => {
    const text = '﻿bundle\tpath\nsales\ta.md'

    expect(parseDelimited(text)).toEqual([{ bundle: 'sales', path: 'a.md' }])
  })
})

describe('rowsToConcepts', () => {
  test('turns unreserved columns into frontmatter and body into prose', () => {
    const { files } = rowsToConcepts([
      {
        bundle: 'sales',
        path: 'tables/orders.md',
        type: 'BigQuery Table',
        grain: 'order_id',
        body: 'One row per order.'
      }
    ])
    const parsed = parseFrontmatter(files[0]?.content ?? '')

    expect(files[0]?.name).toBe('sales/tables/orders.md')
    expect(parsed.data).toEqual({ type: 'BigQuery Table', grain: 'order_id' })
    expect(parsed.body).toBe('\nOne row per order.\n')
  })

  test('drops empty cells rather than writing empty frontmatter fields', () => {
    const { files } = rowsToConcepts([
      { bundle: 'a', path: 'b.md', type: 'T', grain: '', body: 'x' }
    ])

    expect(parseFrontmatter(files[0]?.content ?? '').data).toEqual({
      type: 'T'
    })
  })

  test('reports a row with no type, since OKF requires it', () => {
    const { files, problems } = rowsToConcepts([
      { bundle: 'a', path: 'b.md', body: 'x' }
    ])

    expect(files).toEqual([])
    expect(problems[0]?.reason).toContain('needs a type')
  })

  test('numbers problems the way the spreadsheet does, header included', () => {
    const { problems } = rowsToConcepts([
      { bundle: 'a', path: 'good.md', type: 'T' },
      { bundle: 'a', path: 'bad.txt', type: 'T' }
    ])

    expect(problems).toEqual([
      {
        row: 3,
        reason: expect.stringContaining(
          'must be a .md file'
        ) as unknown as string
      }
    ])
  })

  test('reports an illegal bundle name', () => {
    const { problems } = rowsToConcepts([
      { bundle: 'not a bundle', path: 'b.md', type: 'T' }
    ])

    expect(problems[0]?.reason).toContain('invalid bundle name')
  })
})

describe('manifest export', () => {
  const rows: ManifestRow[] = [
    {
      id: 'orders',
      bundle: 'sales',
      kind: 'bigquery_table',
      status: '',
      grain: 'order_id',
      summary: 'One row per order, with a comma.',
      links: ['customers', 'revenue']
    }
  ]

  test('flattens links into one cell and leaves empty cells empty', () => {
    expect(manifestToRows(rows)[0]).toEqual({
      id: 'orders',
      bundle: 'sales',
      kind: 'bigquery_table',
      status: '',
      grain: 'order_id',
      summary: 'One row per order, with a comma.',
      links: 'customers revenue'
    })
  })

  test('quotes a summary containing the delimiter', () => {
    expect(exportManifest(rows, ',')).toContain(
      '"One row per order, with a comma."'
    )
  })

  test('survives a round trip back through the parser', () => {
    const parsed = parseDelimited(exportManifest(rows, ','))

    expect(parsed[0]?.summary).toBe('One row per order, with a comma.')
    expect(parsed[0]?.links).toBe('customers revenue')
  })

  test('formats tab-separated on request', () => {
    expect(formatDelimited([{ a: '1', b: '2' }], '\t')).toBe('a\tb\n1\t2')
  })
})
