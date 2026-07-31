import { profileId } from './profile.ts'

import type { Profile } from './profile.ts'

interface Props {
  profiles: Profile[]
  busy: boolean
  onOpen: (profile: Profile) => void
  onForget: (profile: Profile) => void
}

export function ProfileList({ profiles, busy, onOpen, onForget }: Props) {
  if (profiles.length === 0) {
    return null
  }

  return (
    <section>
      <h2>Saved connections</h2>
      <ul className="profiles">
        {profiles.map(profile => (
          <li key={profileId(profile)}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(profile)}
            >
              <strong>{profile.name}</strong>
              <span>
                {profile.kind === 'local' ? 'folder' : 'server'} ·{' '}
                {profile.target}
              </span>
            </button>
            <button
              type="button"
              className="forget"
              title={`Forget ${profile.name}`}
              onClick={() => onForget(profile)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
