import { dsvFormat } from 'd3-dsv'

export type Delimiter = ',' | '\t' | ';'

const CANDIDATES: Delimiter[] = [',', '\t', ';']
const BOM = '﻿'

/**
 * d3-dsv does neither of these, and both are what a spreadsheet actually
 * produces: Excel writes a BOM, and a locale using the comma as a decimal
 * separator exports semicolons.
 */
export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text
}

/**
 * The winner is whichever delimiter carves the header into the most fields.
 * Counting on the header alone is enough and avoids being misled by a comma
 * inside a quoted description further down.
 */
export function sniffDelimiter(text: string): Delimiter {
  const header = stripBom(text).split('\n')[0] ?? ''
  let best: Delimiter = ','
  let width = 0

  for (const candidate of CANDIDATES) {
    const fields = dsvFormat(candidate).parseRows(header)[0]?.length ?? 0

    if (fields > width) {
      best = candidate
      width = fields
    }
  }

  return best
}

export function parseDelimited(text: string): Record<string, string>[] {
  const clean = stripBom(text)

  return dsvFormat(sniffDelimiter(clean))
    .parse(clean)
    .map(row => ({ ...row }) as Record<string, string>)
}

export function formatDelimited(
  rows: Record<string, string>[],
  delimiter: Delimiter
): string {
  return dsvFormat(delimiter).format(rows)
}
