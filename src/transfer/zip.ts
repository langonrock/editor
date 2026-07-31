import { unzipSync, zipSync } from 'fflate'

import { MAX_BYTES } from '../okf/paths.ts'

/** A bundle of prose. Anything larger is a mistake or a zip bomb. */
const MAX_TOTAL_BYTES = 200 * 1024 * 1024
const MAX_ENTRIES = 20_000

export interface ArchiveFile {
  /** `<bundle>/<path>`, the layout the OKF folder itself has. */
  name: string
  content: string
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

export function packOkf(files: ArchiveFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {}

  for (const file of files) {
    entries[file.name] = encoder.encode(file.content)
  }

  return zipSync(entries, { level: 6 })
}

/**
 * The caps are enforced in the filter, which fflate calls with each entry's
 * declared uncompressed size *before* inflating it. Checking afterwards would
 * mean the archive had already been expanded into memory, which is exactly what
 * a limit on an archive from outside exists to prevent.
 *
 * Directory entries and anything that is not Markdown are skipped rather than
 * rejected: real archives carry `.DS_Store` and `.gitignore`, and refusing the
 * whole import over one is not useful.
 */
export function unpackOkf(bytes: Uint8Array): ArchiveFile[] {
  let entries = 0
  let total = 0

  const found = unzipSync(bytes, {
    filter: file => {
      entries += 1
      total += file.originalSize

      if (entries > MAX_ENTRIES) {
        throw new Error(`this archive holds over ${MAX_ENTRIES} entries`)
      }

      if (total > MAX_TOTAL_BYTES) {
        throw new Error('this archive expands to more than the 200 MB limit')
      }

      return /\.md$/i.test(file.name) && file.originalSize <= MAX_BYTES
    }
  })

  return Object.entries(found)
    .map(([name, content]) => ({ name, content: decoder.decode(content) }))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
}
