import { parseDsn } from 'langonrock/client'

/**
 * A token sent to a loopback address never leaves the machine, so plain HTTP is
 * fine there and is in fact the only option: the local sidecar cannot serve
 * TLS. Anywhere else a bearer token in clear text is a credential on the wire,
 * which is why this refuses rather than warns.
 */
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1'])

const NOT_A_STORE_DIRECTORY =
  'this is a store directory, which only the server can open. ' +
  'Pick a folder to edit locally, or connect to okf+https://host'

const NO_UNIX_SOCKET =
  'a unix socket cannot be reached from the app window. ' +
  'Run the daemon on loopback TCP and connect with okf+http://127.0.0.1:PORT?token=...'

const NO_NAMED_PIPE =
  'named pipes are not supported by the server. ' +
  'Run the daemon on loopback TCP and connect with okf+http://127.0.0.1:PORT?token=...'

export function isLoopback(hostname: string): boolean {
  return LOOPBACK.has(hostname.replace(/^\[|\]$/g, ''))
}

function assertTransport(transport: string): void {
  if (transport === 'embedded') {
    throw new Error(NOT_A_STORE_DIRECTORY)
  }

  if (transport === 'unix') {
    throw new Error(NO_UNIX_SOCKET)
  }

  if (transport === 'npipe') {
    throw new Error(NO_NAMED_PIPE)
  }
}

/**
 * The gate, and the reason the HTTP capability can afford a wildcard host: no
 * request is ever issued for a DSN this rejects. Called before `connect`, not
 * inside the request path, so a bad profile fails while the user is looking at
 * the dialog that produced it.
 */
export function assertConnectable(dsn: string): void {
  const target = parseDsn(dsn)

  assertTransport(target.transport)

  const origin = new URL(target.origin ?? '')

  if (origin.protocol === 'http:' && !isLoopback(origin.hostname)) {
    throw new Error(
      `refusing to send a token in clear text to ${origin.hostname}: use okf+https://`
    )
  }
}

/**
 * Accepts what a person would paste — a bare host, or a URL with a scheme — and
 * produces the DSN. Anything but an explicit http:// becomes https, so the
 * secure form is what you get by default rather than what you remember to type.
 */
export function buildRemoteDsn(host: string, token: string): string {
  const trimmed = host.trim().replace(/\/+$/, '')
  const scheme = trimmed.startsWith('http://') ? 'okf+http' : 'okf+https'
  const bare = trimmed.replace(/^https?:\/\//, '')

  return `${scheme}://${bare}?token=${encodeURIComponent(token)}`
}

export function buildLocalDsn(port: number, token: string): string {
  return `okf+http://127.0.0.1:${port}?token=${encodeURIComponent(token)}`
}
