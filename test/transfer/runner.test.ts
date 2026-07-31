import { describe, expect, test } from 'bun:test'

import { runImport } from '../../src/transfer/runner.ts'

import type { ImportStep } from '../../src/transfer/zipplan.ts'

const step = (
  path: string,
  overrides: Partial<ImportStep> = {}
): ImportStep => ({
  bundle: 'sales',
  path,
  content: '---\ntype: T\n---\n',
  action: 'create',
  ...overrides
})

describe('runImport', () => {
  test('writes each step and reports the count', async () => {
    const written: string[] = []
    const report = await runImport(
      {
        writeSource: (_b, path) => {
          written.push(path)

          return Promise.resolve('h')
        }
      },
      [step('a.md'), step('b.md')]
    )

    expect(written).toEqual(['a.md', 'b.md'])
    expect(report).toEqual({ written: 2, skipped: 0, failures: [] })
  })

  test('passes the observed hash so a replace carries its precondition', async () => {
    let replaces: string | undefined

    await runImport(
      {
        writeSource: (_b, _p, _c, given) => {
          replaces = given

          return Promise.resolve('h')
        }
      },
      [step('a.md', { action: 'replace', replaces: 'known' })]
    )

    expect(replaces).toBe('known')
  })

  test('never writes a step planned as skip or reject', async () => {
    let calls = 0
    const report = await runImport(
      {
        writeSource: () => {
          calls += 1

          return Promise.resolve('h')
        }
      },
      [step('a.md', { action: 'skip' }), step('b.md', { action: 'reject' })]
    )

    expect(calls).toBe(0)
    expect(report.skipped).toBe(2)
  })

  test('keeps going after a failure rather than leaving a half import', async () => {
    const report = await runImport(
      {
        writeSource: (_b, path) =>
          path === 'b.md'
            ? Promise.reject(
                new Error(
                  'langonrock server returned 412: concept already exists'
                )
              )
            : Promise.resolve('h')
      },
      [step('a.md'), step('b.md'), step('c.md')]
    )

    expect(report.written).toBe(2)
    expect(report.failures).toHaveLength(1)
    expect(report.failures[0]?.failure.kind).toBe('conflict')
    expect(report.failures[0]?.step.path).toBe('b.md')
  })

  test('reports progress once per step, including the ones it skipped', async () => {
    const seen: number[] = []

    await runImport(
      { writeSource: () => Promise.resolve('h') },
      [step('a.md'), step('b.md', { action: 'skip' }), step('c.md')],
      done => seen.push(done)
    )

    expect(seen).toEqual([1, 2, 3])
  })
})
