import { classify } from '../connection/errors.ts'
import {
  MAX_BYTES,
  assertBundleName,
  assertConceptPath,
  byteLength
} from '../okf/paths.ts'
import { toWire } from './document.ts'

import type { Failure } from '../connection/errors.ts'
import type { EditorDocument } from './document.ts'
import type { Connection } from 'langonrock/client'

export type SaveTarget = Pick<Connection, 'writeSource' | 'readSource'>

export type SaveOutcome =
  | { kind: 'saved'; hash: string }
  | { kind: 'conflict'; theirs: string; theirHash: string }
  | { kind: 'rejected'; failure: Failure }

function invalid(cause: unknown): SaveOutcome {
  return {
    kind: 'rejected',
    failure: {
      kind: 'unknown',
      detail: cause instanceof Error ? cause.message : String(cause)
    }
  }
}

/**
 * Checked here as well as on the server so a bad name is refused before a round
 * trip, and so the byte limit is measured the way the server measures it: UTF-8
 * bytes, not string length.
 */
function preflight(document: EditorDocument, content: string): void {
  assertBundleName(document.bundle)
  assertConceptPath(document.path)

  const bytes = byteLength(content)

  if (bytes > MAX_BYTES) {
    throw new Error(
      `this concept is ${bytes} bytes, over the ${MAX_BYTES} byte limit`
    )
  }
}

/**
 * A conflict is not an error to report and forget: the caller needs the version
 * that won in order to show a merge, so it is fetched here and returned as an
 * outcome rather than thrown.
 *
 * A deleted-out-from-under-us file also arrives as 412. `readSource` then
 * returns undefined, which is reported as a rejection instead of a conflict
 * with nothing to merge against.
 */
async function onConflict(
  knowledge: SaveTarget,
  document: EditorDocument,
  failure: Failure
): Promise<SaveOutcome> {
  const found = await knowledge.readSource(document.bundle, document.path)

  if (found === undefined) {
    return { kind: 'rejected', failure }
  }

  return { kind: 'conflict', theirs: found.content, theirHash: found.hash }
}

export async function saveDocument(
  knowledge: SaveTarget,
  document: EditorDocument
): Promise<SaveOutcome> {
  const content = toWire(document)

  try {
    preflight(document, content)
  } catch (cause) {
    return invalid(cause)
  }

  try {
    return {
      kind: 'saved',
      hash: await knowledge.writeSource(
        document.bundle,
        document.path,
        content,
        document.baseHash
      )
    }
  } catch (cause) {
    const failure = classify(cause)

    return failure.kind === 'conflict'
      ? onConflict(knowledge, document, failure)
      : { kind: 'rejected', failure }
  }
}
