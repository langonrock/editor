import type { Eol } from './types.ts'

/**
 * CodeMirror joins its document with `\n` regardless of what was loaded, so a
 * CRLF file edited and saved would come back with every line changed: a whole
 * file diff in the user's git repo, and a new hash that invalidates the ETag
 * for a change nobody made. The fix is to edit in LF and restore on the way
 * out, which means remembering what the file arrived as.
 */
export function detectEol(text: string): Eol {
  const crlf = text.split('\r\n').length - 1
  const lf = text.split('\n').length - 1 - crlf

  return crlf > lf ? '\r\n' : '\n'
}

export function toLf(text: string): string {
  return text.replaceAll('\r\n', '\n')
}

export function restoreEol(text: string, eol: Eol): string {
  return eol === '\n' ? toLf(text) : toLf(text).replaceAll('\n', '\r\n')
}
