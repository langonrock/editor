import { useEffect } from 'react'

import { Banners } from './Banners.tsx'
import { ConflictDialog } from '../editor/ConflictDialog.tsx'
import { ConnectDialog } from './ConnectDialog.tsx'
import { Toolbar } from './Toolbar.tsx'
import { Workspace } from './Workspace.tsx'
import { canWrite } from './reducer.ts'
import { onSidecarLog } from '../local/sidecar.ts'
import { useKnowledge } from './useKnowledge.ts'

import type { SourceEntry } from 'langonrock/client'

/**
 * The id a graph node or a search hit carries is the one the listing reports
 * for the file it compiled from, which is the whole point of it being there.
 */
function opener(
  entries: SourceEntry[],
  open: (bundle: string, path: string) => void
) {
  return (id: string) => {
    const entry = entries.find(item => item.id === id)

    if (entry !== undefined) {
      open(entry.bundle, entry.path)
    }
  }
}

export function App() {
  const app = useKnowledge()
  const { state, dispatch } = app
  const writable = canWrite(state)
  const knowledge = app.knowledge()
  const { conflict, document } = state

  useEffect(() => {
    const stop = onSidecarLog(line => dispatch({ type: 'log', line }))

    return () => void stop.then(unlisten => unlisten())
  }, [dispatch])

  const open = (bundle: string, path: string) => void app.open(bundle, path)

  if (state.phase !== 'ready') {
    return (
      <ConnectDialog
        busy={state.phase === 'connecting'}
        error={state.error}
        onConnect={(profile, token, remember) =>
          void app.connect(profile, token, remember)
        }
      />
    )
  }

  return (
    <div className="app">
      <Toolbar
        panel={state.panel}
        knowledge={knowledge}
        entries={state.entries}
        rows={state.rows}
        writable={writable}
        connection={state.connection}
        onPanel={panel => dispatch({ type: 'panel', panel })}
        onNotice={notice => dispatch({ type: 'notice', notice })}
        onDisconnect={() => void app.disconnect()}
      />

      <Banners
        writable={writable}
        stale={state.stale}
        notice={state.notice}
        onReload={() => void app.reload(document)}
        onDismiss={() => dispatch({ type: 'notice' })}
      />

      <Workspace
        state={state}
        writable={writable}
        knowledge={knowledge}
        open={open}
        openById={opener(state.entries, open)}
        onChange={draft => dispatch({ type: 'edited', draft })}
        onSave={() => document && void app.persist(document)}
        onDelete={() => document && void app.remove(document)}
        onSearch={app.search}
        onPassage={app.passage}
      />

      {conflict === undefined || document === undefined ? null : (
        <ConflictDialog
          conflict={conflict}
          mine={document.draft}
          onMerged={merged => dispatch({ type: 'merging', merged })}
          onCancel={() => dispatch({ type: 'closed' })}
          onResolve={text =>
            void app.resolve(document, conflict.theirHash, text)
          }
        />
      )}
    </div>
  )
}
