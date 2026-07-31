import { afterSave, withDraft } from '../editor/document.ts'

import type { Failure } from '../connection/errors.ts'
import type { StoreAccess } from '../connection/session.ts'
import type { EditorDocument } from '../editor/document.ts'
import type { ManifestRow } from '../okf/types.ts'
import type { SourceEntry } from 'langonrock/client'
import type { Diagnostic } from '../connection/session.ts'

export type Panel = 'editor' | 'graph' | 'search'

export interface Conflict {
  theirs: string
  theirHash: string
  merged: string
  clean: boolean
}

/**
 * The optional fields are written `| undefined` on purpose. Under
 * exactOptionalPropertyTypes an optional property cannot be *assigned*
 * undefined, and clearing a field is precisely how this reducer closes a
 * dialog or dismisses a notice.
 */
export interface AppState {
  phase: 'idle' | 'connecting' | 'ready'
  error?: string | undefined
  access: StoreAccess
  /**
   * A read-only token is invisible until the first save is refused, so unlike
   * `access` this cannot be known at connect time. Kept separate rather than
   * folded in, because the two become true at different moments.
   */
  readOnlyToken: boolean
  entries: SourceEntry[]
  rows: ManifestRow[]
  diagnostics: Diagnostic[]
  document?: EditorDocument | undefined
  conflict?: Conflict | undefined
  panel: Panel
  logs: string[]
  notice?: string | undefined
  /** The store moved under us, so what is on screen may be behind. */
  stale: boolean
}

export const initialState: AppState = {
  phase: 'idle',
  access: 'writable',
  readOnlyToken: false,
  entries: [],
  rows: [],
  diagnostics: [],
  panel: 'editor',
  logs: [],
  stale: false
}

export type Action =
  | { type: 'connecting' }
  | { type: 'connected'; access: StoreAccess; entries: SourceEntry[] }
  | { type: 'failed'; error: string }
  | { type: 'disconnected' }
  | { type: 'entries'; entries: SourceEntry[] }
  | { type: 'manifest'; rows: ManifestRow[] }
  | { type: 'synced'; diagnostics: Diagnostic[] }
  | { type: 'opened'; document: EditorDocument }
  | { type: 'closed' }
  | { type: 'edited'; draft: string }
  | { type: 'saved'; hash: string }
  | { type: 'conflict'; conflict: Conflict }
  | { type: 'merging'; merged: string }
  | { type: 'resolved'; document: EditorDocument }
  | { type: 'rejected'; failure: Failure }
  | { type: 'panel'; panel: Panel }
  | { type: 'log'; line: string }
  | { type: 'notice'; notice?: string | undefined }
  | { type: 'stale'; stale: boolean }

type Handler<A extends Action> = (state: AppState, action: A) => AppState

/** The most recent lines are all a user acts on, and the list is unbounded. */
const LOG_LIMIT = 500

/**
 * A map rather than a switch. Every case in a switch counts toward cyclomatic
 * complexity, and a state machine this size would blow past the project's
 * ceiling for a reason that says nothing about how hard it is to read.
 */
const HANDLERS = {
  connecting: state => ({ ...state, phase: 'connecting', error: undefined }),
  connected: (state, action) => ({
    ...state,
    phase: 'ready',
    access: action.access,
    entries: action.entries,
    error: undefined
  }),
  failed: (state, action) => ({ ...state, phase: 'idle', error: action.error }),
  disconnected: () => initialState,
  entries: (state, action) => ({ ...state, entries: action.entries }),
  manifest: (state, action) => ({ ...state, rows: action.rows }),
  synced: (state, action) => ({
    ...state,
    diagnostics: action.diagnostics,
    stale: false
  }),
  opened: (state, action) => ({
    ...state,
    document: action.document,
    conflict: undefined,
    panel: 'editor'
  }),
  closed: state => ({ ...state, document: undefined, conflict: undefined }),
  edited: (state, action) =>
    state.document === undefined
      ? state
      : { ...state, document: withDraft(state.document, action.draft) },
  saved: (state, action) =>
    state.document === undefined
      ? state
      : {
          ...state,
          document: afterSave(state.document, action.hash),
          conflict: undefined,
          notice: undefined
        },
  conflict: (state, action) => ({ ...state, conflict: action.conflict }),
  merging: (state, action) =>
    state.conflict === undefined
      ? state
      : { ...state, conflict: { ...state.conflict, merged: action.merged } },
  resolved: (state, action) => ({
    ...state,
    document: action.document,
    conflict: undefined
  }),
  rejected: (state, action) => ({
    ...state,
    notice: action.failure.detail,
    readOnlyToken:
      state.readOnlyToken || action.failure.kind === 'read-only-token'
  }),
  panel: (state, action) => ({ ...state, panel: action.panel }),
  log: (state, action) => ({
    ...state,
    logs: [...state.logs, action.line].slice(-LOG_LIMIT)
  }),
  notice: (state, action) => ({ ...state, notice: action.notice }),
  stale: (state, action) => ({ ...state, stale: action.stale })
} satisfies { [K in Action['type']]: Handler<Extract<Action, { type: K }>> }

export function reduce(state: AppState, action: Action): AppState {
  const handler = HANDLERS[action.type] as Handler<Action>

  return handler(state, action)
}

export function canWrite(state: AppState): boolean {
  return state.access === 'writable' && !state.readOnlyToken
}
