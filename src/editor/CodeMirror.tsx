import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { useEffect, useRef } from 'react'

import { useLatest } from '../app/useLatest.ts'

interface Props {
  value: string
  readOnly?: boolean
  onChange?: (value: string) => void
}

/**
 * Plain-text editing on purpose. The ETag the whole write cycle rests on is a
 * hash of the file's bytes, so a rich editor that reformatted markdown on load
 * would invalidate it for a change the user never made.
 */
export function CodeMirror({ value, readOnly = false, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView>(null)
  const notify = useLatest(onChange)

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
          // Until something declares otherwise the base theme applies its light
          // variant, whose `caret-color: black` is invisible against this app's
          // background: the caret is there and typing works, but nothing shows.
          EditorView.darkTheme.of(true),
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
    const editor = view.current

    if (editor !== null && editor.state.doc.toString() !== value) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value }
      })
    }
  }, [value])

  return <div className="codemirror" ref={host} />
}
