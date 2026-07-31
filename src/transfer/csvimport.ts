import { composeConcept } from '../okf/frontmatter.ts'
import { assertBundleName, assertConceptPath } from '../okf/paths.ts'

import type { Frontmatter } from '../okf/types.ts'
import type { ArchiveFile } from './zip.ts'

/** Columns the importer understands. Everything else becomes frontmatter. */
const BUNDLE = 'bundle'
const PATH = 'path'
const BODY = 'body'
const RESERVED = new Set([BUNDLE, PATH, BODY])

export interface RowProblem {
  row: number
  reason: string
}

export interface CsvImport {
  files: ArchiveFile[]
  problems: RowProblem[]
}

function frontmatterOf(row: Record<string, string>): Frontmatter {
  const data: Frontmatter = {}

  for (const [column, value] of Object.entries(row)) {
    if (!RESERVED.has(column) && value !== '') {
      data[column] = value
    }
  }

  return data
}

function problemOf(row: Record<string, string>): string | undefined {
  const bundle = row[BUNDLE] ?? ''
  const path = row[PATH] ?? ''

  try {
    assertBundleName(bundle)
    assertConceptPath(path)
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause)
  }

  return row.type === undefined || row.type === ''
    ? 'a concept needs a type, which is the one field OKF requires'
    : undefined
}

/**
 * A spreadsheet row becomes one Markdown file: `bundle` and `path` say where it
 * goes, `body` is the prose, and every other non-empty column becomes a
 * frontmatter field. Nothing is written here; a bad row is reported with its
 * number so the user can fix the sheet rather than hunt through the result.
 */
export function rowsToConcepts(rows: Record<string, string>[]): CsvImport {
  const files: ArchiveFile[] = []
  const problems: RowProblem[] = []

  rows.forEach((row, index) => {
    const reason = problemOf(row)

    if (reason !== undefined) {
      // Row 1 is the header, so the first data row is row 2 in the sheet.
      problems.push({ row: index + 2, reason })

      return
    }

    files.push({
      name: `${row[BUNDLE]}/${row[PATH]}`,
      content: composeConcept(frontmatterOf(row), `\n${row[BODY] ?? ''}\n`)
    })
  })

  return { files, problems }
}
