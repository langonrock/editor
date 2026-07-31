import { TransferBar } from '../transfer/TransferBar.tsx'
import { toggleTheme, useTheme } from './theme.ts'

import type { Panel } from './reducer.ts'
import type { ManifestRow } from '../okf/types.ts'
import type { Profile } from '../profiles/profile.ts'
import type { ImportTarget } from '../transfer/runner.ts'
import type { Connection, SourceEntry } from 'langonrock/client'

const PANELS: Panel[] = ['editor', 'graph', 'search']

interface Props {
  panel: Panel
  knowledge?: (Pick<Connection, 'readSource'> & ImportTarget) | undefined
  entries: SourceEntry[]
  rows: ManifestRow[]
  writable: boolean
  connection?: Profile | undefined
  onPanel: (panel: Panel) => void
  onNotice: (message: string) => void
  onDisconnect: () => void
}

export function Toolbar(props: Props) {
  const theme = useTheme()

  return (
    <nav>
      {PANELS.map(panel => (
        <button
          key={panel}
          type="button"
          className={props.panel === panel ? 'tab active' : 'tab'}
          onClick={() => props.onPanel(panel)}
        >
          {panel}
        </button>
      ))}
      <div className="tools">
        {props.connection === undefined ? null : (
          <button
            type="button"
            className="connection"
            title={`Connected to ${props.connection.target} — switch`}
            onClick={props.onDisconnect}
          >
            {props.connection.name}
          </button>
        )}
        {props.knowledge === undefined ? null : (
          <TransferBar
            knowledge={props.knowledge}
            entries={props.entries}
            rows={props.rows}
            canWrite={props.writable}
            onDone={props.onNotice}
          />
        )}
        <button
          type="button"
          className="theme"
          title={`Switch to the ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </nav>
  )
}
