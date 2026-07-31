import { detectEol, restoreEol, toLf } from '../okf/eol.ts'

import type { Eol } from '../okf/types.ts'
import type { SourceFile } from 'langonrock/client'

export interface EditorDocument {
  bundle: string
  path: string
  /**
   * The hash the next write must present. Undefined means the file does not
   * exist yet, which the client turns into `If-None-Match: *` so a create can
   * never quietly overwrite something that appeared in the meantime.
   */
  baseHash?: string
  baseText: string
  draft: string
  eol: Eol
}

/**
 * Editing happens in LF and the original ending is restored on the way out, so
 * opening a CRLF file and saving it unchanged produces the same bytes and the
 * same hash rather than a whole-file diff.
 */
export function openDocument(
  bundle: string,
  path: string,
  file: SourceFile
): EditorDocument {
  const text = toLf(file.content)

  return {
    bundle,
    path,
    baseHash: file.hash,
    baseText: text,
    draft: text,
    eol: detectEol(file.content)
  }
}

export function newDocument(
  bundle: string,
  path: string,
  template: string
): EditorDocument {
  return { bundle, path, baseText: '', draft: toLf(template), eol: '\n' }
}

export function isDirty(document: EditorDocument): boolean {
  return document.draft !== document.baseText
}

export function isNew(document: EditorDocument): boolean {
  return document.baseHash === undefined
}

/**
 * Whether the server's copy may replace what is on screen. An unsaved draft
 * belongs to the reader, not to the store: replacing one because the folder
 * moved underneath would throw the edit away silently, while keeping it means
 * the next save meets the precondition failure and the merge, which is
 * recoverable.
 */
export function canReload(
  document?: EditorDocument
): document is EditorDocument {
  return document !== undefined && !isDirty(document)
}

export function toWire(document: EditorDocument): string {
  return restoreEol(document.draft, document.eol)
}

export function withDraft(
  document: EditorDocument,
  draft: string
): EditorDocument {
  return { ...document, draft }
}

export function afterSave(
  document: EditorDocument,
  hash: string
): EditorDocument {
  return { ...document, baseHash: hash, baseText: document.draft }
}

/**
 * Every conflict resolution rebases onto the version just observed, never onto
 * the stale one, so the retry cannot 412 for the same reason twice.
 */
export function rebase(
  document: EditorDocument,
  theirs: string,
  theirHash: string,
  draft: string
): EditorDocument {
  return { ...document, baseHash: theirHash, baseText: toLf(theirs), draft }
}
