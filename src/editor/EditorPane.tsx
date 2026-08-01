import { Save, Trash2 } from 'lucide-react'

import { byteLength } from '../okf/paths.ts'
import { CodeMirror } from './CodeMirror.tsx'
import { FrontmatterForm } from './FrontmatterForm.tsx'
import { isDirty, isNew } from './document.ts'

import type { EditorDocument } from './document.ts'

interface Props {
  document?: EditorDocument | undefined
  readOnly: boolean
  onChange: (draft: string) => void
  onSave: () => void
  onDelete: () => void
}

function Status({ document }: { document: EditorDocument }) {
  return (
    <span className="status">
      {byteLength(document.draft)} bytes
      {document.eol === '\r\n' ? ' · CRLF' : ''}
      {isNew(document) ? ' · new' : ''}
      {isDirty(document) ? ' · unsaved' : ' · saved'}
    </span>
  )
}

export function EditorPane({
  document,
  readOnly,
  onChange,
  onSave,
  onDelete
}: Props) {
  if (document === undefined) {
    return (
      <div className="empty">
        <p>Pick a concept on the left, or create one.</p>
      </div>
    )
  }

  return (
    <div className="editor">
      <header>
        <h2>
          {document.bundle}/{document.path}
        </h2>
        <Status document={document} />
        <button
          type="button"
          onClick={onDelete}
          disabled={readOnly || isNew(document)}
        >
          <Trash2 />
          Delete
        </button>
        <button
          type="button"
          className="primary"
          onClick={onSave}
          disabled={readOnly || !isDirty(document)}
        >
          <Save />
          Save
        </button>
      </header>

      <FrontmatterForm
        source={document.draft}
        readOnly={readOnly}
        onChange={onChange}
      />

      <CodeMirror
        value={document.draft}
        readOnly={readOnly}
        onChange={onChange}
      />
    </div>
  )
}
