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

  return {
    id: cell(values, columns, 'id'),
    bundle: cell(values, columns, 'bundle'),
    kind: cell(values, columns, 'kind'),
    status: cell(values, columns, 'status'),
    grain: cell(values, columns, 'grain'),
    summary: cell(values, columns, 'summary'),
    links: links === '' ? [] : links.split(' ')
  }
}

/**
 * One parser for every TSV the server produces. A bundle-filtered manifest and
 * a search result carry the same header and differ only in which comment lines
 * precede it, so reading the columns by name rather than by position covers all
 * three without branching on which one arrived.
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
