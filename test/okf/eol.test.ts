import { describe, expect, test } from 'bun:test'

import { detectEol, restoreEol, toLf } from '../../src/okf/eol.ts'

describe('detectEol', () => {
  test('reads the dominant ending rather than the first one', () => {
    expect(detectEol('a\r\nb\r\nc\nd')).toBe('\r\n')
    expect(detectEol('a\nb\nc\r\nd')).toBe('\n')
  })

  test('defaults to lf for a tie and for a file with no newline', () => {
    expect(detectEol('a\r\nb\nc')).toBe('\n')
    expect(detectEol('no newline here')).toBe('\n')
  })
})

describe('restoreEol', () => {
  test('round-trips a crlf document byte for byte', () => {
    const original = '---\r\ntype: Table\r\n---\r\n\r\nBody line.\r\n'
    const eol = detectEol(original)

    expect(restoreEol(toLf(original), eol)).toBe(original)
  })

  test('round-trips an lf document byte for byte', () => {
    const original = '---\ntype: Table\n---\n\nBody line.\n'

    expect(restoreEol(toLf(original), detectEol(original))).toBe(original)
  })

  test('does not double convert text that is already crlf', () => {
    expect(restoreEol('a\r\nb', '\r\n')).toBe('a\r\nb')
  })

  test('flattens crlf when the file was lf', () => {
    expect(restoreEol('a\r\nb', '\n')).toBe('a\nb')
  })
})
