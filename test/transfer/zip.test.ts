import { describe, expect, test } from 'bun:test'
import { zipSync } from 'fflate'

import { packOkf, unpackOkf } from '../../src/transfer/zip.ts'

const FILES = [
  { name: 'sales/tables/orders.md', content: '---\ntype: Table\n---\n\nA.\n' },
  {
    name: 'sales/metrics/revenue.md',
    content: '---\ntype: Metric\n---\n\nB.\n'
  },
  { name: 'ops/runbooks/deploy.md', content: '---\ntype: Runbook\n---\n\nC.\n' }
]

describe('packOkf and unpackOkf', () => {
  test('round-trips a bundle byte for byte', () => {
    expect(unpackOkf(packOkf(FILES))).toEqual(
      [...FILES].sort((a, b) => (a.name < b.name ? -1 : 1))
    )
  })

  test('round-trips content that is not ascii', () => {
    const accented = [
      { name: 'a/é.md', content: '---\ntype: Nota\n---\n\nDescrição: ação.\n' }
    ]

    expect(unpackOkf(packOkf(accented))).toEqual(accented)
  })

  test('returns entries in a stable order regardless of input order', () => {
    const forwards = unpackOkf(packOkf(FILES)).map(file => file.name)
    const backwards = unpackOkf(packOkf([...FILES].reverse())).map(f => f.name)

    expect(forwards).toEqual(backwards)
  })

  test('skips the furniture a real archive carries', () => {
    const archive = zipSync({
      'sales/orders.md': new TextEncoder().encode('---\ntype: T\n---\n'),
      'sales/.DS_Store': new TextEncoder().encode('junk'),
      '.gitignore': new TextEncoder().encode('node_modules'),
      'sales/notes.txt': new TextEncoder().encode('not a concept')
    })

    expect(unpackOkf(archive).map(file => file.name)).toEqual([
      'sales/orders.md'
    ])
  })

  test('drops a single entry that exceeds the concept limit', () => {
    const archive = zipSync({
      'a/huge.md': new TextEncoder().encode('x'.repeat(1_000_001)),
      'a/small.md': new TextEncoder().encode('ok')
    })

    expect(unpackOkf(archive).map(file => file.name)).toEqual(['a/small.md'])
  })

  test('refuses an archive that expands past the total limit', () => {
    // Highly compressible, so the archive is small and the expansion is not.
    const archive = zipSync({
      'a/bomb.md': new TextEncoder().encode('a'.repeat(250 * 1024 * 1024))
    })

    expect(() => unpackOkf(archive)).toThrow('200 MB limit')
  })

  test('packs an empty selection into a readable empty archive', () => {
    expect(unpackOkf(packOkf([]))).toEqual([])
  })
})
