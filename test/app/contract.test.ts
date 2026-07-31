import { describe, expect, test } from 'bun:test'

import { runContractChecks } from '../../src/app/contract.ts'

const HASH = 'a'.repeat(64)

const served = (status: number, body: string) =>
  new Error(`langonrock server returned ${status}: ${body}`)

function backend(overrides: Record<string, unknown> = {}) {
  return {
    writeSource: (_b: string, _p: string, _c: string, replaces?: string) =>
      replaces === undefined
        ? Promise.resolve(HASH)
        : Promise.reject(served(412, 'concept changed since it was read')),
    readSource: () => Promise.resolve({ content: 'x', hash: HASH }),
    deleteSource: () => Promise.resolve(),
    manifest: () => Promise.resolve('# tenant: acme\nid\tbundle\n'),
    ...overrides
  }
}

const ok = (checks: { ok: boolean }[]) => checks.every(check => check.ok)

describe('runContractChecks', () => {
  test('passes on a backend that preserves the whole protocol', async () => {
    const checks = await runContractChecks(backend(), 'sales')

    expect(checks).toHaveLength(4)
    expect(ok(checks)).toBe(true)
  })

  test('fails the first check when the ETag is stripped from a 204', async () => {
    const checks = await runContractChecks(
      backend({ writeSource: () => Promise.resolve('') }),
      'sales'
    )

    // Nothing after this can be trusted, so it stops rather than reporting
    // three more failures that all have the same cause.
    expect(checks).toHaveLength(1)
    expect(checks[0]?.detail).toContain('empty or stripped')
  })

  test('fails when the read loses the ETag', async () => {
    const checks = await runContractChecks(
      backend({
        readSource: () => Promise.resolve({ content: 'x', hash: '' })
      }),
      'sales'
    )

    expect(checks[1]?.ok).toBe(false)
  })

  test('fails when If-Match never reaches the server', async () => {
    const checks = await runContractChecks(
      backend({ writeSource: () => Promise.resolve(HASH) }),
      'sales'
    )

    expect(checks[2]).toMatchObject({
      ok: false,
      detail: 'the write was accepted'
    })
  })

  test('fails when a repeated manifest comes back different', async () => {
    let calls = 0
    const checks = await runContractChecks(
      backend({
        manifest: () => {
          calls += 1

          return Promise.resolve(`# call ${calls}\nid\tbundle\n`)
        }
      }),
      'sales'
    )

    expect(checks[3]?.ok).toBe(false)
  })

  test('reports a create that failed outright instead of throwing', async () => {
    const checks = await runContractChecks(
      backend({
        writeSource: () => Promise.reject(served(403, 'read but not write'))
      }),
      'sales'
    )

    expect(checks).toHaveLength(1)
    expect(checks[0]?.ok).toBe(false)
  })
})
