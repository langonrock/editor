/**
 * The client throws a plain Error whose message embeds the status, so this
 * regex is the only way back to it. It is pinned by tests against the exact
 * strings the server produces; if the client ever throws a typed error, this
 * module is the single place that changes.
 */
const STATUS = /^langonrock server returned (\d{3}):/

export type FailureKind =
  | 'conflict'
  | 'missing-precondition'
  | 'too-large'
  | 'read-only-token'
  | 'read-only-store'
  | 'unauthorized'
  | 'not-found'
  | 'unknown'

export interface Failure {
  kind: FailureKind
  status?: number
  /** What the server said, for the cases where showing it is the honest move. */
  detail: string
}

const KINDS: Record<number, FailureKind> = {
  401: 'unauthorized',
  403: 'read-only-token',
  404: 'not-found',
  409: 'read-only-store',
  412: 'conflict',
  413: 'too-large',
  428: 'missing-precondition'
}

export function statusOf(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error)
  const status = STATUS.exec(message)?.[1]

  return status === undefined ? undefined : Number(status)
}

export function classify(error: unknown): Failure {
  const status = statusOf(error)
  const detail = error instanceof Error ? error.message : String(error)

  if (status === undefined) {
    return { kind: 'unknown', detail }
  }

  return { kind: KINDS[status] ?? 'unknown', status, detail }
}

const EXPLANATIONS: Record<FailureKind, string> = {
  conflict: 'This concept changed since you opened it.',
  'missing-precondition':
    'The app sent a write without saying which version it replaces. This is a bug in the editor.',
  'too-large': 'A concept may not exceed 1 MB.',
  'read-only-token': 'This token may read but not write.',
  'read-only-store':
    'This store has no source directory configured, so nothing can be written to it.',
  unauthorized: 'The token was rejected.',
  'not-found': 'The server could not find that, or failed while compiling it.',
  unknown: 'The server rejected the request.'
}

export function explain(failure: Failure): string {
  return EXPLANATIONS[failure.kind]
}
