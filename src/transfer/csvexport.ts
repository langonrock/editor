import { formatDelimited } from './csv.ts'

import type { ManifestRow } from '../okf/types.ts'
import type { Delimiter } from './csv.ts'

/**
 * The manifest already is a TSV, but not one a spreadsheet reads well: `-`
 * stands for an empty cell and links are space separated inside one field.
 * Exporting turns both back into something a person can sort and filter.
 */
export function manifestToRows(rows: ManifestRow[]): Record<string, string>[] {
  return rows.map(row => ({
    id: row.id,
    bundle: row.bundle,
    kind: row.kind,
    status: row.status,
    grain: row.grain,
    summary: row.summary,
    links: row.links.join(' ')
  }))
}

export function exportManifest(
  rows: ManifestRow[],
  delimiter: Delimiter
): string {
  return formatDelimited(manifestToRows(rows), delimiter)
}
