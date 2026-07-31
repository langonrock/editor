import { classify } from '../connection/errors.ts'

import type { Connection } from 'langonrock/client'

/** Written and removed by the check itself, in a bundle the user picked. */
const PROBE = '__langoneditor_probe__.md'
const BODY = '---\ntype: Probe\n---\n\nWritten by the connection self-check.\n'

export interface Check {
  name: string
  ok: boolean
  detail: string
}

type Probe = Pick<
  Connection,
  'writeSource' | 'readSource' | 'deleteSource' | 'manifest'
>

/**
 * The one link no test in this repo can reach: whether the HTTP backend the
 * window uses preserves what the write protocol depends on. A `204 No Content`
 * carrying an `ETag`, a `304` passing through with its quoted tag, and
 * `If-Match` and `If-None-Match` surviving the trip are all invisible to a
 * `bun test` run, which talks to the server through Bun's own fetch.
 *
 * So the app checks itself, against the store it is connected to, and says
 * plainly which half is broken when something does not work.
 */
export async function runContractChecks(
  knowledge: Probe,
  bundle: string
): Promise<Check[]> {
  const checks: Check[] = []
  const add = (name: string, ok: boolean, detail: string) =>
    checks.push({ name, ok, detail })

  let created = ''

  try {
    created = await knowledge.writeSource(bundle, PROBE, BODY)
  } catch (cause) {
    add('a create returns 204 with a usable ETag', false, String(cause))

    return checks
  }

  const usable = /^[0-9a-f]{64}$/.test(created)

  add(
    'a create returns 204 with a usable ETag',
    usable,
    created === '' ? 'the ETag was empty or stripped' : created.slice(0, 12)
  )

  // Every check below compares against this value, so continuing without one
  // would report three more failures that all have the same single cause.
  if (!usable) {
    return checks
  }

  const found = await knowledge.readSource(bundle, PROBE)

  add(
    'a read reports the same ETag',
    found?.hash === created,
    found?.hash ?? 'no ETag on the response'
  )

  try {
    await knowledge.writeSource(bundle, PROBE, 'x', '0'.repeat(64))
    add('a stale write is refused', false, 'the write was accepted')
  } catch (cause) {
    const failure = classify(cause)

    add(
      'a stale write is refused',
      failure.kind === 'conflict',
      `If-Match reached the server: ${failure.status ?? 'no status'}`
    )
  }

  const first = await knowledge.manifest()
  const second = await knowledge.manifest()

  add(
    'a repeated manifest is served from the ETag cache',
    first === second,
    `${first.length} bytes both times`
  )

  await knowledge.deleteSource(bundle, PROBE, created).catch(() => undefined)

  return checks
}
