import { assertBundleName, assertConceptPath } from '../okf/paths.ts'

import type { ArchiveFile } from './zip.ts'
import type { SourceEntry } from 'langonrock/client'

export type StepAction = 'create' | 'replace' | 'skip' | 'reject'

export interface ImportStep {
  bundle: string
  path: string
  content: string
  action: StepAction
  /** The hash being replaced, so the write carries a precondition. */
  replaces?: string
  reason?: string
}

function split(name: string): { bundle: string; path: string } | undefined {
  const cut = name.indexOf('/')

  return cut <= 0
    ? undefined
    : { bundle: name.slice(0, cut), path: name.slice(cut + 1) }
}

function validate(bundle: string, path: string): string | undefined {
  try {
    assertBundleName(bundle)
    assertConceptPath(path)

    return undefined
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause)
  }
}

/**
 * The whole plan is computed before anything is written, so the user is shown
 * what an import will do rather than discovering it halfway through. Every
 * replacement carries the hash it observed, which means a concurrent edit turns
 * into a refused write instead of a silent overwrite.
 */
export function planImport(
  files: ArchiveFile[],
  existing: SourceEntry[],
  overwrite: boolean
): ImportStep[] {
  const current = new Map(
    existing.map(entry => [`${entry.bundle}/${entry.path}`, entry.hash])
  )

  return files.map(file => {
    const parts = split(file.name)

    if (parts === undefined) {
      return {
        bundle: '',
        path: file.name,
        content: file.content,
        action: 'reject',
        reason: 'a concept must live in a bundle folder, as <bundle>/<path>.md'
      }
    }

    const { bundle, path } = parts
    const reason = validate(bundle, path)

    if (reason !== undefined) {
      return { bundle, path, content: file.content, action: 'reject', reason }
    }

    const hash = current.get(file.name)
    const base = { bundle, path, content: file.content }

    if (hash === undefined) {
      return { ...base, action: 'create' }
    }

    return overwrite
      ? { ...base, action: 'replace', replaces: hash }
      : { ...base, action: 'skip', reason: 'a concept already exists here' }
  })
}

export function summarize(steps: ImportStep[]): Record<StepAction, number> {
  const counts: Record<StepAction, number> = {
    create: 0,
    replace: 0,
    skip: 0,
    reject: 0
  }

  for (const step of steps) {
    counts[step.action] += 1
  }

  return counts
}
