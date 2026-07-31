import { describe, expect, test } from 'bun:test'

import { planImport, summarize } from '../../src/transfer/zipplan.ts'

import type { SourceEntry } from 'langonrock/client'

const existing: SourceEntry[] = [
  { bundle: 'sales', path: 'orders.md', bytes: 10, hash: 'known', id: 'orders' }
]

const file = (name: string) => ({ name, content: '---\ntype: T\n---\n' })

describe('planImport', () => {
  test('creates what is not there yet', () => {
    const [step] = planImport([file('sales/new.md')], existing, false)

    expect(step?.action).toBe('create')
    expect(step?.replaces).toBeUndefined()
  })

  test('skips an existing concept when not overwriting', () => {
    const [step] = planImport([file('sales/orders.md')], existing, false)

    expect(step?.action).toBe('skip')
  })

  test('replaces against the hash it observed, never blindly', () => {
    const [step] = planImport([file('sales/orders.md')], existing, true)

    expect(step?.action).toBe('replace')
    expect(step?.replaces).toBe('known')
  })

  test('rejects a file that is not inside a bundle folder', () => {
    const [step] = planImport([file('loose.md')], existing, false)

    expect(step?.action).toBe('reject')
    expect(step?.reason).toContain('must live in a bundle folder')
  })

  test.each([
    ['sales/../escape.md', 'a traversal'],
    ['sales/.hidden/x.md', 'a dot directory'],
    ['sales/notes.txt', 'a file that is not markdown'],
    ['not a bundle/x.md', 'an illegal bundle name']
  ])('rejects %p, %s', name => {
    const [step] = planImport([file(name)], existing, false)

    expect(step?.action).toBe('reject')
  })

  test('plans everything before anything is written', () => {
    const steps = planImport(
      [file('sales/new.md'), file('sales/orders.md'), file('loose.md')],
      existing,
      false
    )

    expect(summarize(steps)).toEqual({
      create: 1,
      replace: 0,
      skip: 1,
      reject: 1
    })
  })
})
