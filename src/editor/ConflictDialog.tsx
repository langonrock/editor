import { CodeMirror } from './CodeMirror.tsx'

import type { Conflict } from '../app/reducer.ts'

interface Props {
  conflict: Conflict
  mine: string
  onMerged: (merged: string) => void
  onResolve: (text: string) => void
  onCancel: () => void
}

/**
 * Every button here writes against `theirHash`, the version just observed,
 * never against the one the server refused. Retrying with the stale hash would
 * fail for the same reason a second time, which reads to the user as the app
 * being broken rather than as someone else having edited the file.
 */
export function ConflictDialog({
  conflict,
  mine,
  onMerged,
  onResolve,
  onCancel
}: Props) {
  return (
    <div className="overlay">
      <div className="dialog wide">
        <h2>This concept changed while you were editing it</h2>
        <p>
          {conflict.clean
            ? 'The two versions were merged without overlap. Review it before saving.'
            : 'Both versions changed the same lines. The conflict is marked below.'}
        </p>

        <div className="panes">
          <section>
            <h3>Theirs</h3>
            <CodeMirror value={conflict.theirs} readOnly />
          </section>
          <section>
            <h3>Merged</h3>
            <CodeMirror value={conflict.merged} onChange={onMerged} />
          </section>
        </div>

        <footer>
          <button type="button" onClick={onCancel}>
            Keep editing
          </button>
          <button type="button" onClick={() => onResolve(conflict.theirs)}>
            Discard mine, take theirs
          </button>
          <button type="button" onClick={() => onResolve(mine)}>
            Overwrite with mine
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => onResolve(conflict.merged)}
          >
            Save merged
          </button>
        </footer>
      </div>
    </div>
  )
}
