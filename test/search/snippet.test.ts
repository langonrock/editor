import { describe, expect, test } from 'bun:test'

import { snippetAround } from '../../src/search/snippet.ts'

const filler = (length: number) => 'z'.repeat(length)

describe('snippetAround', () => {
  test('cuts around the first query word rather than the start', () => {
    const text = `${filler(500)} needle ${filler(500)}`

    expect(snippetAround(text, 'needle', 90)).toContain('needle')
  })

  test('marks both cuts so a fragment is not read as the whole passage', () => {
    const text = `${filler(500)} needle ${filler(500)}`
    const snippet = snippetAround(text, 'needle', 90)

    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
  })

  test('leaves a passage shorter than the width unmarked', () => {
    expect(snippetAround('a short passage', 'passage', 90)).toBe(
      'a short passage'
    )
  })

  test('collapses the whitespace a markdown body arrives with', () => {
    expect(snippetAround('one\n\n  two\tthree\n', 'two', 90)).toBe(
      'one two three'
    )
  })

  test('falls back to the head of the window when no word occurs', () => {
    const text = `${filler(300)} tail`

    expect(snippetAround(text, 'absent', 50).startsWith('zzz')).toBe(true)
  })

  test('matches case-insensitively, the way the server located it', () => {
    const text = `${filler(500)} NEEDLE ${filler(500)}`

    expect(snippetAround(text, 'needle', 90)).toContain('NEEDLE')
  })

  test('keeps the match visible rather than putting it at the edge', () => {
    const text = `${filler(500)} needle ${filler(500)}`
    const snippet = snippetAround(text, 'needle', 90)

    expect(snippet.indexOf('needle')).toBeGreaterThan(20)
  })

  test('is empty for an empty window', () => {
    expect(snippetAround('   ', 'needle', 90)).toBe('')
  })
})
