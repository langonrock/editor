import { describe, expect, test } from 'bun:test'

import {
  afterSave,
  isDirty,
  isNew,
  newDocument,
  openDocument,
  rebase,
  toWire,
  withDraft
} from '../../src/editor/document.ts'

const CRLF = '---\r\ntype: Table\r\n---\r\n\r\nBody.\r\n'

describe('openDocument', () => {
  test('edits in lf and remembers the ending it arrived as', () => {
    const document = openDocument('sales', 'a.md', {
      content: CRLF,
      hash: 'abc'
    })

    expect(document.eol).toBe('\r\n')
    expect(document.draft).not.toContain('\r')
    expect(document.baseHash).toBe('abc')
  })

  test('an untouched crlf file writes back byte for byte', () => {
    const document = openDocument('sales', 'a.md', {
      content: CRLF,
      hash: 'abc'
    })

    expect(toWire(document)).toBe(CRLF)
    expect(isDirty(document)).toBe(false)
  })
})

describe('newDocument', () => {
  test('has no hash, which is what makes the write a create', () => {
    const document = newDocument('sales', 'new.md', '---\ntype: X\n---\n')

    expect(isNew(document)).toBe(true)
    expect(document.baseHash).toBeUndefined()
  })

  test('counts as dirty, so an unsaved new file is never lost silently', () => {
    expect(isDirty(newDocument('sales', 'new.md', 'x'))).toBe(true)
  })
})

describe('withDraft and afterSave', () => {
  test('a draft makes the document dirty until it is saved', () => {
    const opened = openDocument('sales', 'a.md', { content: 'x\n', hash: 'h1' })
    const edited = withDraft(opened, 'y\n')

    expect(isDirty(edited)).toBe(true)
    expect(isDirty(afterSave(edited, 'h2'))).toBe(false)
  })

  test('saving adopts the new hash, so the next write is not stale', () => {
    const opened = openDocument('sales', 'a.md', { content: 'x\n', hash: 'h1' })

    expect(afterSave(withDraft(opened, 'y\n'), 'h2').baseHash).toBe('h2')
  })
})

describe('rebase', () => {
  test('adopts the hash just observed, never the one that was refused', () => {
    const opened = openDocument('sales', 'a.md', {
      content: 'x\n',
      hash: 'old'
    })
    const rebased = rebase(opened, 'theirs\n', 'fresh', 'merged\n')

    expect(rebased.baseHash).toBe('fresh')
    expect(rebased.baseText).toBe('theirs\n')
    expect(rebased.draft).toBe('merged\n')
  })

  test('taking theirs verbatim leaves nothing to save', () => {
    const opened = openDocument('sales', 'a.md', {
      content: 'x\n',
      hash: 'old'
    })

    expect(isDirty(rebase(opened, 'theirs\n', 'fresh', 'theirs\n'))).toBe(false)
  })
})
