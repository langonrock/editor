export interface Profile {
  kind: 'local' | 'remote'
  /** The folder holding the bundles, or the host of the server. */
  target: string
  name: string
}

/**
 * What identifies a profile differs by kind, and both directions matter.
 *
 * A remote is keyed by name because two profiles can reach the same host with
 * different tokens — a read-only one and a writable one — and keying by host
 * would have them overwrite each other's keychain entry.
 *
 * A folder is keyed by its path because it holds no secret and the path is its
 * identity: keying by name would let a second `/b/kb` silently replace `/a/kb`,
 * both of which default to the name "kb".
 */
export const profileId = (profile: Profile) =>
  profile.kind === 'local'
    ? `local:${profile.target}`
    : `remote:${profile.name}`

/** Windows paths arrive with backslashes, and a picker may leave a separator. */
export function defaultName(kind: Profile['kind'], target: string): string {
  if (kind === 'remote') {
    return target
  }

  const segments = target.split(/[/\\]/).filter(segment => segment !== '')

  return segments[segments.length - 1] ?? target
}

/** Newest first: the list doubles as the history of what was last opened. */
export function saveProfile(list: Profile[], profile: Profile): Profile[] {
  const id = profileId(profile)

  return [profile, ...list.filter(item => profileId(item) !== id)]
}

export function dropProfile(list: Profile[], id: string): Profile[] {
  return list.filter(item => profileId(item) !== id)
}

function isProfile(value: unknown): value is Profile {
  const candidate = value as Partial<Profile> | null

  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    (candidate.kind === 'local' || candidate.kind === 'remote') &&
    typeof candidate.target === 'string' &&
    candidate.target !== '' &&
    typeof candidate.name === 'string' &&
    candidate.name !== ''
  )
}

/**
 * Anything can be in storage: a half-written value, a list from a version that
 * shaped these differently, or nothing at all. A connection list is not worth
 * an error dialog, so unreadable entries are dropped and the rest still opens.
 */
export function parseProfiles(stored: string | null): Profile[] {
  if (stored === null) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(stored)

    return Array.isArray(parsed) ? parsed.filter(isProfile) : []
  } catch {
    return []
  }
}
