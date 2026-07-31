import { useState } from 'react'

import { runContractChecks } from './contract.ts'

import type { Check } from './contract.ts'
import type { Diagnostic } from '../connection/session.ts'
import type { Connection } from 'langonrock/client'

interface Props {
  diagnostics: Diagnostic[]
  logs: string[]
  onOpen: (path: string) => void
  /** Absent when the connection cannot be written to, since the check writes. */
  selfCheck?: { knowledge: Connection; bundle: string } | undefined
}

function SelfCheck({
  knowledge,
  bundle
}: {
  knowledge: Connection
  bundle: string
}) {
  const [checks, setChecks] = useState<Check[]>([])
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)

    try {
      setChecks(await runContractChecks(knowledge, bundle))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={() => void run()}>
        {busy ? 'Checking…' : 'Check this connection'}
      </button>
      <ul>
        {checks.map(check => (
          <li key={check.name} className={check.ok ? '' : 'warn'}>
            <code>{check.ok ? 'pass' : 'FAIL'}</code>
            <span>{check.name}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * These come from the compiler itself, through the sync response, rather than
 * being reproduced here. Duplicating the rules would guarantee that the editor
 * and the server eventually disagree about what is wrong with a file.
 */
export function Diagnostics({ diagnostics, logs, onOpen, selfCheck }: Props) {
  return (
    <aside className="diagnostics">
      <h3>Lint {diagnostics.length === 0 ? '' : `(${diagnostics.length})`}</h3>

      {diagnostics.length === 0 ? (
        <p className="small">The compiler reported nothing.</p>
      ) : (
        <ul>
          {diagnostics.map(item => (
            <li key={`${item.path}:${item.message}`} className={item.level}>
              <button type="button" onClick={() => onOpen(item.path)}>
                <code>{item.path}</code>
                <span>{item.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>Server</h3>
      <pre className="logs">{logs.slice(-40).join('\n')}</pre>

      {selfCheck === undefined ? null : (
        <>
          <h3>Connection</h3>
          <SelfCheck
            knowledge={selfCheck.knowledge}
            bundle={selfCheck.bundle}
          />
        </>
      )}
    </aside>
  )
}
