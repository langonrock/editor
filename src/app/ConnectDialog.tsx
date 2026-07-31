import { useState } from 'react'

import { ProfileList } from '../profiles/ProfileList.tsx'
import { defaultName, profileId } from '../profiles/profile.ts'
import { deleteSecret } from '../secrets/keychain.ts'
import { pickFolder } from '../local/sidecar.ts'
import { useProfiles } from '../profiles/useProfiles.ts'

import type { Profile } from '../profiles/profile.ts'

interface Props {
  busy: boolean
  error?: string | undefined
  onConnect: (profile: Profile, token?: string, remember?: boolean) => void
}

/**
 * The https rule is stated here rather than only enforced, because a user who
 * pastes an http:// address deserves to know why it was refused before they
 * press the button.
 */
function RemoteForm({
  busy,
  onSubmit
}: {
  busy: boolean
  onSubmit: (profile: Profile, token: string, remember: boolean) => void
}) {
  const [host, setHost] = useState('')
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(true)

  return (
    <section>
      <h2>Connect to a server</h2>
      <label>
        Host
        <input
          value={host}
          placeholder="kb.example.com"
          onChange={event => setHost(event.target.value)}
        />
      </label>
      <label>
        Name
        <input
          value={name}
          placeholder={host === '' ? 'kb.example.com' : host}
          onChange={event => setName(event.target.value)}
        />
      </label>
      <label>
        Token
        <input
          type="password"
          value={token}
          onChange={event => setToken(event.target.value)}
        />
      </label>
      <label className="inline">
        <input
          type="checkbox"
          checked={remember}
          onChange={event => setRemember(event.target.checked)}
        />
        Remember in the system keychain
      </label>
      <p className="small">
        Anything but a loopback address must be https, since the token would
        otherwise cross the network in clear text.
      </p>
      <button
        type="button"
        disabled={busy || host === '' || token === ''}
        onClick={() =>
          onSubmit(
            { kind: 'remote', target: host, name: name === '' ? host : name },
            token,
            remember
          )
        }
      >
        Connect
      </button>
    </section>
  )
}

export function ConnectDialog({ busy, error, onConnect }: Props) {
  const { profiles, remember, forget } = useProfiles()

  const open = (profile: Profile, token?: string, keep = true) => {
    remember(profile)
    onConnect(profile, token, keep)
  }

  const choose = async () => {
    const folder = await pickFolder()

    if (folder !== null) {
      open({
        kind: 'local',
        target: folder,
        name: defaultName('local', folder)
      })
    }
  }

  const drop = (profile: Profile) => {
    forget(profileId(profile))

    if (profile.kind === 'remote') {
      void deleteSecret(profileId(profile)).catch(() => undefined)
    }
  }

  return (
    <div className="overlay">
      <div className="dialog">
        <h1>langoneditor</h1>

        <ProfileList
          profiles={profiles}
          busy={busy}
          onOpen={open}
          onForget={drop}
        />

        <section>
          <h2>Open a folder</h2>
          <p>
            Pick the folder holding your bundles. Each bundle is a directory
            inside it, and the app runs its own server against a copy of the
            index, never touching your store.
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void choose()}
          >
            {busy ? 'Starting…' : 'Choose folder'}
          </button>
        </section>

        <RemoteForm busy={busy} onSubmit={open} />

        {error === undefined ? null : <p className="warn">{error}</p>}
      </div>
    </div>
  )
}
