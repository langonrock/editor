import { describe, expect, test } from 'bun:test'

import {
  MAX_BYTES,
  assertBundleName,
  assertConceptPath,
  byteLength
} from '../../src/okf/paths.ts'

// The cases in these two blocks are copied verbatim from langonrock's
// test/sourcepaths.test.ts. They are a contract: if the server loosens or
// tightens a rule, this file fails rather than the user discovering it as a
// rejected save.
describe('assertBundleName', () => {
  test('accepts a plain name and rejects anything with a separator', () => {
    expect(assertBundleName('sales')).toBe('sales')
    expect(() => assertBundleName('sales/ops')).toThrow('invalid bundle name')
    expect(() => assertBundleName('..')).toThrow('invalid bundle name')
    expect(() => assertBundleName('')).toThrow('invalid bundle name')
  })

  test('accepts the longest legal name and rejects one character more', () => {
    expect(assertBundleName('a'.repeat(64))).toHaveLength(64)
    expect(() => assertBundleName('a'.repeat(65))).toThrow(
      'invalid bundle name'
    )
  })
})

describe('assertConceptPath', () => {
  test('accepts a nested markdown path', () => {
    expect(assertConceptPath('tables/orders.md')).toBe('tables/orders.md')
  })

  test.each([
    ['../../etc/passwd.md', 'traversal'],
    ['tables/../../escape.md', 'a traversal in the middle'],
    ['/etc/passwd.md', 'an absolute path'],
    ['tables\\orders.md', 'a windows separator'],
    ['.hidden/orders.md', 'a dot directory the watcher would ignore'],
    ['tables/orders.txt', 'a file that is not markdown'],
    ['tables//orders.md', 'an empty segment']
  ])('rejects %p, %s', path => {
    expect(() => assertConceptPath(path)).toThrow('invalid path')
  })

  test('rejects a path long enough to break Windows', () => {
    expect(() => assertConceptPath(`${'a'.repeat(300)}.md`)).toThrow(
      'longer than'
    )
  })

  test('rejects a null byte', () => {
    expect(() => assertConceptPath('tables/or\0ders.md')).toThrow(
      'invalid path'
    )
  })

  test('accepts exactly 200 characters and rejects 201', () => {
    const longest = `${'a'.repeat(197)}.md`

    expect(longest).toHaveLength(200)
    expect(assertConceptPath(longest)).toBe(longest)
    expect(() => assertConceptPath(`a${longest}`)).toThrow('longer than')
  })

  test('accepts an uppercase extension, because the server does', () => {
    expect(assertConceptPath('tables/Orders.MD')).toBe('tables/Orders.MD')
  })
})

describe('byteLength', () => {
  test('counts utf-8 bytes rather than string length', () => {
    expect(byteLength('e')).toBe(1)
    expect(byteLength('é')).toBe(2)
    expect(byteLength('😀')).toBe(4)
  })

  test('lands exactly on the server limit for a multi-byte document', () => {
    const atLimit = 'é'.repeat(MAX_BYTES / 2)

    expect(byteLength(atLimit)).toBe(MAX_BYTES)
    expect(byteLength(`${atLimit}a`)).toBe(MAX_BYTES + 1)
  })
})
