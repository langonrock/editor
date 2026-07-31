import { useState } from 'react'

interface Props {
  busy: boolean
  error?: string | undefined
  onLocal: () => void
  onRemote: (host: string, token: string, remember: boolean) => void
}

/**
 * The https rule is stated here rather than only enforced, because a user who
 * pastes an http:// address deserves to know why it was refused before they
 * press the button.
 */
export function ConnectDialog({ busy, error, onLocal, onRemote }: Props) {
  const [host, setHost] = useState('')
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(true)

  return (
    <div className="overlay">
      <div className="dialog">
        <h1>langoneditor</h1>

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
            onClick={onLocal}
          >
            {busy ? 'Starting…' : 'Choose folder'}
          </button>
        </section>

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
            onClick={() => onRemote(host, token, remember)}
          >
            Connect
          </button>
        </section>

        {error === undefined ? null : <p className="warn">{error}</p>}
      </div>
    </div>
  )
}
