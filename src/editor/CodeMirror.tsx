import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { useEffect, useRef } from 'react'

import { useLatest } from '../app/useLatest.ts'
import { useTheme } from '../app/theme.ts'

interface Props {
  value: string
  readOnly?: boolean
  onChange?: (value: string) => void
}

/**
 * The base theme picks a caret colour per variant — black under `&light`, white
 * under `&dark` — so an editor that never says which one it is in gets an
 * invisible caret on one of the two palettes. It goes in a compartment because
 * rebuilding the view to restyle it would throw away the undo history.
 */
const PALETTE = new Compartment()

/**
 * Plain-text editing on purpose. The ETag the whole write cycle rests on is a
 * hash of the file's bytes, so a rich editor that reformatted markdown on load
 * would invalidate it for a change the user never made.
 */
export function CodeMirror({ value, readOnly = false, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView>(null)
  const notify = useLatest(onChange)
  const dark = useTheme() === 'dark'

  useEffect(() => {
    if (host.current === null) {
      return
    }

    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          PALETTE.of(EditorView.darkTheme.of(dark)),
          EditorState.readOnly.of(readOnly),
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              notify.current?.(update.state.doc.toString())
            }
          })
        ]
      })
    })

    view.current = editor

    return () => editor.destroy()
    // Rebuilding on every keystroke would lose the cursor, so the document is
    // only seeded here and reconciled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  useEffect(() => {
    view.current?.dispatch({
      effects: PALETTE.reconfigure(EditorView.darkTheme.of(dark))
    })
  }, [dark])

  useEffect(() => {
    const editor = view.current

    if (editor !== null && editor.state.doc.toString() !== value) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value }
      })
    }
  }, [value])

  return <div className="codemirror" ref={host} />
}
