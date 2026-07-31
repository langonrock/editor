import { ConceptTree } from '../tree/ConceptTree.tsx'
import { Diagnostics } from './Diagnostics.tsx'
import { EditorPane } from '../editor/EditorPane.tsx'
import { GraphView } from '../graph/GraphView.tsx'
import { SearchPanel } from '../search/SearchPanel.tsx'

import type { AppState } from './reducer.ts'
import type { Connection } from 'langonrock/client'

interface Props {
  state: AppState
  writable: boolean
  knowledge?: Connection | undefined
  open: (bundle: string, path: string) => void
  openById: (id: string) => void
  onChange: (draft: string) => void
  onSave: () => void
  onDelete: () => void
  onSearch: (query: string) => Promise<string>
}

function selectionOf(state: AppState): string | undefined {
  return state.document === undefined
    ? undefined
    : `${state.document.bundle}/${state.document.path}`
}

/**
 * The check writes a probe concept, so it needs a writable connection and a
 * bundle that already exists — creating one as a side effect of a diagnostic
 * would leave a directory behind in the user's folder.
 */
function selfCheckOf(props: Props) {
  const bundle = props.state.entries[0]?.bundle

  return props.knowledge === undefined ||
    !props.writable ||
    bundle === undefined
    ? undefined
    : { knowledge: props.knowledge, bundle }
}

export function Workspace(props: Props) {
  const { state, writable } = props

  return (
    <main>
      <ConceptTree
        entries={state.entries}
        selected={selectionOf(state)}
        onOpen={props.open}
      />

      <section className="panel">
        {state.panel === 'editor' ? (
          <EditorPane
            document={state.document}
            readOnly={!writable}
            onChange={props.onChange}
            onSave={props.onSave}
            onDelete={props.onDelete}
          />
        ) : null}
        {state.panel === 'graph' ? (
          <GraphView rows={state.rows} onSelect={props.openById} />
        ) : null}
        {state.panel === 'search' ? (
          <SearchPanel onSearch={props.onSearch} onSelect={props.openById} />
        ) : null}
      </section>

      <Diagnostics
        diagnostics={state.diagnostics}
        logs={state.logs}
        selfCheck={selfCheckOf(props)}
        onOpen={path => {
          const entry = state.entries.find(item => item.path === path)

          if (entry !== undefined) {
            props.open(entry.bundle, entry.path)
          }
        }}
      />
    </main>
  )
}
