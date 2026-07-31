import { describe, expect, test } from 'bun:test'

import { merge3 } from '../../src/editor/merge.ts'

const BASE = 'one\ntwo\nthree\n'

describe('merge3', () => {
  test('identical edits are not a conflict', () => {
    expect(merge3(BASE, 'x\n', 'x\n')).toEqual({ text: 'x\n', clean: true })
  })

  test('takes theirs when only they changed it', () => {
    expect(merge3(BASE, BASE, 'one\nTWO\nthree\n')).toEqual({
      text: 'one\nTWO\nthree\n',
      clean: true
    })
  })

  test('takes mine when only I changed it', () => {
    expect(merge3(BASE, 'one\nMINE\nthree\n', BASE)).toEqual({
      text: 'one\nMINE\nthree\n',
      clean: true
    })
  })

  test('merges cleanly when one side left the differing region alone', () => {
    const result = merge3(BASE, 'one\ntwo\nthree\nfour\n', BASE)

    expect(result.clean).toBe(true)
    expect(result.text).toBe('one\ntwo\nthree\nfour\n')
  })

  test('marks a region both sides rewrote, keeping both texts', () => {
    const result = merge3(BASE, 'one\nMINE\nthree\n', 'one\nTHEIRS\nthree\n')

    expect(result.clean).toBe(false)
    expect(result.text).toBe(
      'one\n<<<<<<< yours\nMINE\n=======\nTHEIRS\n>>>>>>> theirs\nthree\n'
    )
  })

  test('never drops an edit, even when the two are far apart', () => {
    const base = 'a\nb\nc\nd\ne\n'
    const result = merge3(base, 'A\nb\nc\nd\ne\n', 'a\nb\nc\nd\nE\n')

    expect(result.clean).toBe(false)
    expect(result.text).toContain('A')
    expect(result.text).toContain('E')
  })

  test('handles one side deleting everything', () => {
    const result = merge3(BASE, '', 'one\nTWO\nthree\n')

    expect(result.clean).toBe(false)
    expect(result.text).toContain('TWO')
  })

  test('keeps the shared prefix and suffix out of the conflict block', () => {
    const base = 'header\nx\nfooter\n'
    const result = merge3(base, 'header\nm\nfooter\n', 'header\nt\nfooter\n')

    expect(result.text.startsWith('header\n<<<<<<< yours')).toBe(true)
    expect(result.text.endsWith('>>>>>>> theirs\nfooter\n')).toBe(true)
  })
})
