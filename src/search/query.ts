import { parseManifest } from '../okf/manifest.ts'

import type { ManifestRow } from '../okf/types.ts'

const HITS = /^# hits:\s*(\d+) direct,\s*(\d+) linked/
const QUERY = /^# query:\s*(.*)$/

export interface SearchResult {
  query: string
  rows: ManifestRow[]
  /** Ranked by BM25 against the query. */
  direct: number
  /** Pulled in by one hop along a link, so relevant but not matched. */
  linked: number
}

/**
 * Search returns a manifest with two extra comment lines. Reading the counts
 * matters because the tail of the list was never matched by the query: it was
 * reached by a link, and presenting it as a match would be a lie about why it
 * is there.
 */
export function parseSearch(tsv: string): SearchResult {
  const { comments, rows } = parseManifest(tsv)
  const hits = comments.map(line => HITS.exec(line)).find(Boolean)
  const query = comments.map(line => QUERY.exec(line)).find(Boolean)

  return {
    query: query?.[1] ?? '',
    rows,
    direct: Number(hits?.[1] ?? rows.length),
    linked: Number(hits?.[2] ?? 0)
  }
}

export function isLinkedOnly(result: SearchResult, index: number): boolean {
  return index >= result.direct
}
