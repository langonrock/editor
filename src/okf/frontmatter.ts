import { parse, parseDocument, stringify } from 'yaml'

import type { Frontmatter, ParsedConcept } from './types.ts'

/**
 * The compiler's own delimiter, copied rather than approximated. A file whose
 * frontmatter this regex misses is not a concept as far as the server is
 * concerned, so a looser rule here would show the user a form for fields that
 * will never reach the manifest.
 */
const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

function isPlainObject(value: unknown): value is Frontmatter {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasFrontmatter(source: string): boolean {
  return FRONTMATTER.test(source)
}

export function parseFrontmatter(source: string): ParsedConcept {
  const match = FRONTMATTER.exec(source)

  if (!match) {
    return { data: {}, body: source }
  }

  const body = source.slice(match[0].length)

  try {
    const parsed: unknown = parse(match[1] ?? '')

    if (!isPlainObject(parsed)) {
      return { data: {}, body, error: 'frontmatter is not a mapping' }
    }

    return { data: parsed, body }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)

    return { data: {}, body, error: `invalid YAML frontmatter: ${message}` }
  }
}

/**
 * The exact inverse of `parseFrontmatter`: the body is written back untouched,
 * so a parse followed by a compose returns the original bytes. That is what
 * lets the editor round-trip a file it did not change without invalidating its
 * hash. The body keeps its own leading newline, which is why none is added.
 */
export function composeConcept(data: Frontmatter, body: string): string {
  return `---\n${stringify(data)}---\n${body}`
}

/**
 * Left to its defaults the serializer pads flow collections and folds long
 * scalars, so editing `status` would also rewrite an untouched `tags: [a, b]`
 * and rewrap a long description. Both turn a one-field edit into a diff across
 * the whole header.
 */
const KEEP_AUTHOR_LAYOUT = { flowCollectionPadding: false, lineWidth: 0 }

/**
 * Sets or removes individual keys while leaving the rest of the document as the
 * author wrote it: key order, comments and block style all survive, because a
 * form that edits `status` should not silently reformat someone's `sources`
 * list. A key set to undefined is removed.
 */
export function updateFrontmatter(
  source: string,
  changes: Frontmatter
): string {
  const match = FRONTMATTER.exec(source)

  if (!match) {
    return composeConcept(changes, source)
  }

  const document = parseDocument(match[1] ?? '')

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) {
      document.delete(key)
    } else {
      document.set(key, value)
    }
  }

  const yaml = document.toString(KEEP_AUTHOR_LAYOUT)

  return `---\n${yaml}---\n${source.slice(match[0].length)}`
}
