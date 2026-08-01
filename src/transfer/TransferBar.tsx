import { Download, Upload } from 'lucide-react'
import { useState } from 'react'

import { exportManifest } from './csvexport.ts'
import { packOkf, unpackOkf } from './zip.ts'
import { parseDelimited } from './csv.ts'
import { pickAndRead, pickAndWrite } from '../local/sidecar.ts'
import { planImport, summarize } from './zipplan.ts'
import { rowsToConcepts } from './csvimport.ts'
import { runImport } from './runner.ts'

import type { ManifestRow } from '../okf/types.ts'
import type { ArchiveFile } from './zip.ts'
import type { ImportTarget } from './runner.ts'
import type { Connection, SourceEntry } from 'langonrock/client'

type Reader = Pick<Connection, 'readSource'>

interface Props {
  knowledge: Reader & ImportTarget
  entries: SourceEntry[]
  rows: ManifestRow[]
  canWrite: boolean
  onDone: (message: string) => void
}

/**
 * Read one at a time. The server holds a single writer lock per tenant and
 * recompiles on sync, so parallel reads buy nothing worth the burst.
 */
async function collect(
  knowledge: Reader,
  entries: SourceEntry[]
): Promise<ArchiveFile[]> {
  const files: ArchiveFile[] = []

  for (const entry of entries) {
    const found = await knowledge.readSource(entry.bundle, entry.path)

    if (found !== undefined) {
      files.push({
        name: `${entry.bundle}/${entry.path}`,
        content: found.content
      })
    }
  }

  return files
}

async function exportZip(
  knowledge: Reader,
  entries: SourceEntry[]
): Promise<string> {
  const bytes = packOkf(await collect(knowledge, entries))

  return (await pickAndWrite('bundles.zip', [...bytes]))
    ? `Exported ${entries.length} files.`
    : 'Export cancelled.'
}

async function exportCsv(rows: ManifestRow[]): Promise<string> {
  const bytes = [...new TextEncoder().encode(exportManifest(rows, ','))]

  return (await pickAndWrite('manifest.csv', bytes))
    ? `Exported ${rows.length} rows.`
    : 'Export cancelled.'
}

function filesFrom(name: string, bytes: number[]): ArchiveFile[] {
  if (name.endsWith('.zip')) {
    return unpackOkf(new Uint8Array(bytes))
  }

  const text = new TextDecoder().decode(new Uint8Array(bytes))

  return rowsToConcepts(parseDelimited(text)).files
}

async function runFrom(
  knowledge: ImportTarget,
  entries: SourceEntry[],
  extensions: string[]
): Promise<string> {
  const picked = await pickAndRead(extensions)

  if (picked === null) {
    return 'Import cancelled.'
  }

  const steps = planImport(filesFrom(picked.name, picked.bytes), entries, false)
  const report = await runImport(knowledge, steps)
  const counts = summarize(steps)

  return `Wrote ${report.written}, skipped ${counts.skip + counts.reject}, failed ${report.failures.length}.`
}

export function TransferBar({
  knowledge,
  entries,
  rows,
  canWrite,
  onDone
}: Props) {
  const [busy, setBusy] = useState(false)

  const guard = async (work: () => Promise<string>) => {
    setBusy(true)

    try {
      onDone(await work())
    } catch (cause) {
      onDone(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="transfer">
      <button
        type="button"
        disabled={busy}
        onClick={() => void guard(() => exportZip(knowledge, entries))}
      >
        <Download />
        Export zip
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void guard(() => exportCsv(rows))}
      >
        <Download />
        Export CSV
      </button>
      <button
        type="button"
        disabled={busy || !canWrite}
        onClick={() => void guard(() => runFrom(knowledge, entries, ['zip']))}
      >
        <Upload />
        Import zip
      </button>
      <button
        type="button"
        disabled={busy || !canWrite}
        onClick={() =>
          void guard(() => runFrom(knowledge, entries, ['csv', 'tsv', 'txt']))
        }
      >
        <Upload />
        Import CSV
      </button>
    </div>
  )
}
