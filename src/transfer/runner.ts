import { classify } from '../connection/errors.ts'

import type { Failure } from '../connection/errors.ts'
import type { ImportStep } from './zipplan.ts'
import type { Connection } from 'langonrock/client'

export type ImportTarget = Pick<Connection, 'writeSource'>

export interface ImportFailure {
  step: ImportStep
  failure: Failure
}

export interface ImportReport {
  written: number
  skipped: number
  failures: ImportFailure[]
}

/**
 * Written one at a time rather than in parallel. The server holds a single
 * writer lock per tenant and recompiles the whole tenant on sync, so a burst of
 * concurrent writes buys nothing and makes progress impossible to report
 * honestly.
 *
 * A failed file does not abort the run: an import of two hundred concepts that
 * stops on the third leaves the folder in a state nobody asked for. Every
 * failure is collected and reported at the end instead.
 */
export async function runImport(
  knowledge: ImportTarget,
  steps: ImportStep[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportReport> {
  const report: ImportReport = { written: 0, skipped: 0, failures: [] }
  let done = 0

  for (const step of steps) {
    if (step.action === 'skip' || step.action === 'reject') {
      report.skipped += 1
    } else {
      try {
        await knowledge.writeSource(
          step.bundle,
          step.path,
          step.content,
          step.replaces
        )
        report.written += 1
      } catch (cause) {
        report.failures.push({ step, failure: classify(cause) })
      }
    }

    done += 1
    onProgress?.(done, steps.length)
  }

  return report
}
