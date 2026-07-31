/**
 * The call signature only, not `typeof fetch`. Tauri's HTTP plugin exports a
 * drop-in replacement that lacks the static `preconnect` member, and requiring
 * it would reject the one backend this exists to install.
 */
export type FetchBackend = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  return input instanceof URL ? input.href : input.url
}

function isRemote(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

/**
 * The langonrock client calls the global `fetch` from inside a closure and
 * offers no injection point, so reaching the server from a webview means
 * replacing the global. The server sends no CORS headers and has no OPTIONS
 * handler, so the browser's own fetch is blocked for local and remote alike.
 *
 * Only absolute http(s) requests are diverted. Routing everything through the
 * backend would send Vite's module graph and source maps through Rust too.
 *
 * This dispatcher is the seam: swapping Tauri's HTTP plugin for a Rust command
 * over reqwest is a change to the argument, and to nothing else in the app.
 */
export function installOkfFetch(backend: FetchBackend): () => void {
  const native = globalThis.fetch
  const dispatch: FetchBackend = (input, init) =>
    isRemote(urlOf(input)) ? backend(input, init) : native(input, init)

  globalThis.fetch = dispatch as typeof globalThis.fetch

  return () => {
    globalThis.fetch = native
  }
}
