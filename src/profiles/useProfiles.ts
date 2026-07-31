import { useState } from 'react'

import { dropProfile, parseProfiles, saveProfile } from './profile.ts'

import type { Profile } from './profile.ts'

const KEY = 'langoneditor.connections'

/**
 * Names and targets only. Tokens live in the OS keychain keyed by profile id,
 * so this list is safe to write in the clear and safe to lose.
 */
export function useProfiles() {
  const [profiles, setProfiles] = useState(() =>
    parseProfiles(localStorage.getItem(KEY))
  )

  const update = (next: Profile[]) => {
    localStorage.setItem(KEY, JSON.stringify(next))
    setProfiles(next)
  }

  return {
    profiles,
    remember: (profile: Profile) => update(saveProfile(profiles, profile)),
    forget: (id: string) => update(dropProfile(profiles, id))
  }
}
