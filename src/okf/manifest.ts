import type { Manifest, ManifestRow } from './types.ts'

/** The compiler writes this where a value is absent. */
const EMPTY_CELL = '-'

const HEADER_PREFIX = 'id\t'

function cell(row: string[], columns: string[], name: string): string {
  const value = row[columns.indexOf(name)] ?? EMPTY_CELL

  return value === EMPTY_CELL ? '' : value
}

function toRow(line: string, columns: string[]): ManifestRow {
  const values = line.split('\t')
  const links = cell(values, columns, 'links')
  // An empty cell and a zero offset are different answers: a hit whose passage
  // starts at the top of the document is located, not unlocated.
  const located = cell(values, columns, 'pos')
  const pos = Number(located)

  return {
    id: cell(values, columns, 'id'),
    bundle: cell(values, columns, 'bundle'),
    kind: cell(values, columns, 'kind'),
    status: cell(values, columns, 'status'),
    grain: cell(values, columns, 'grain'),
    summary: cell(values, columns, 'summary'),
    links: links === '' ? [] : links.split(' '),
    ...(located !== '' && Number.isFinite(pos) ? { pos } : {})
  }
}

/**
 * One parser for every TSV the server produces. The headers are not identical
 * — a search result appends a `pos` column the manifest has no use for, and
 * the comment lines above them differ — so every cell is read by column name.
 * Reading by position would have broken the moment `pos` arrived, and would
 * break again on the next column. Do not simplify this back.
 */
export function parseManifest(tsv: string): Manifest {
  const lines = tsv.split('\n').filter(line => line !== '')
  const header = lines.findIndex(line => line.startsWith(HEADER_PREFIX))

  if (header === -1) {
    throw new Error('manifest has no header row')
  }

  const columns = (lines[header] ?? '').split('\t')

  return {
    comments: lines.slice(0, header),
    columns,
    rows: lines.slice(header + 1).map(line => toRow(line, columns))
  }
}
