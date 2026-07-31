const BUNDLE_NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i
const MD_EXTENSION = /\.md$/i

/** Windows caps a path at 260 characters unless long paths are enabled. */
const MAX_RELATIVE = 200

/** A concept is prose. Anything this large is a mistake or an attack. */
export const MAX_BYTES = 1_000_000

const encoder = new TextEncoder()

/**
 * These rules are the server's, reproduced so a bad name is refused while the
 * user is still typing rather than after a round trip. The server validates
 * again and remains the authority; this is feedback, not enforcement. Their
 * test vectors are copied verbatim in the test file so a change upstream shows
 * up here as a failure instead of as a mysterious rejection at save time.
 */
export function assertBundleName(bundle: string): string {
  if (!BUNDLE_NAME.test(bundle)) {
    throw new Error(
      `invalid bundle name "${bundle}": expected 1-64 chars of [a-z0-9_-]`
    )
  }

  return bundle
}

function assertSegment(segment: string, path: string): void {
  if (!SEGMENT.test(segment)) {
    throw new Error(
      `invalid path "${path}": segment "${segment}" is empty, starts with a dot, or has a character outside [a-z0-9._-]`
    )
  }
}

export function assertConceptPath(path: string): string {
  if (path.length > MAX_RELATIVE) {
    throw new Error(
      `invalid path "${path}": longer than ${MAX_RELATIVE} characters`
    )
  }

  if (path.includes('\0') || path.includes('\\')) {
    throw new Error(`invalid path "${path}": use forward slashes only`)
  }

  if (path.startsWith('/')) {
    throw new Error(`invalid path "${path}": must be relative to the bundle`)
  }

  if (!MD_EXTENSION.test(path)) {
    throw new Error(`invalid path "${path}": a concept must be a .md file`)
  }

  for (const segment of path.split('/')) {
    assertSegment(segment, path)
  }

  return path
}

/**
 * UTF-8 bytes, because that is what the server counts. A string length would
 * let an accented document past the check and fail at the far end with a 413.
 */
export function byteLength(text: string): number {
  return encoder.encode(text).length
}
