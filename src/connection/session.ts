import { connect } from 'langonrock/client'

import { classify } from './errors.ts'
import { assertConnectable } from './dsn.ts'

import type { Connection, SourceEntry, SyncResult } from 'langonrock/client'

/**
 * Derived rather than imported: the client entrypoint re-exports the other
 * shared types but not this one. Reading it off `SyncResult` keeps it tied to
 * the same source of truth instead of being redeclared here and drifting.
 */
export type Diagnostic = SyncResult['diagnostics'][number]

/**
 * Two different read-only states exist and they are discovered at two different
 * moments, so collapsing them would mislead.
 *
 * A store with no sources.json answers the source listing with 409, which is
 * detectable the moment we connect. A read-only *token* lists and reads source
 * happily and only reveals itself as a 403 on the first save, because the
 * listing route never checks writability. Only the first one belongs here.
 */
export type StoreAccess = 'writable' | 'read-only'

export interface Session {
  knowledge: Connection
  access: StoreAccess
  entries: SourceEntry[]
  close: () => Promise<void>
}

export async function openSession(dsn: string): Promise<Session> {
  assertConnectable(dsn)

  const knowledge = connect(dsn)
  const close = () => knowledge.close()

  try {
    return {
      knowledge,
      access: 'writable',
      entries: await knowledge.listSource(),
      close
    }
  } catch (cause) {
    if (classify(cause).kind !== 'read-only-store') {
      throw cause
    }

    return { knowledge, access: 'read-only', entries: [], close }
  }
}
