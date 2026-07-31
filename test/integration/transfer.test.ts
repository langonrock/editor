import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { connect } from 'langonrock/client'

import { packOkf, unpackOkf } from '../../src/transfer/zip.ts'
import { parseDelimited } from '../../src/transfer/csv.ts'
import { parseManifest } from '../../src/okf/manifest.ts'
import { planImport } from '../../src/transfer/zipplan.ts'
import { rowsToConcepts } from '../../src/transfer/csvimport.ts'
import { runImport } from '../../src/transfer/runner.ts'
import { startStore } from './harness.ts'

import type { Connection } from 'langonrock/client'
import type { Store } from './harness.ts'

const SHEET = [
  'bundle,path,type,description,grain,body',
  'sales,metrics/revenue.md,Metric,Net revenue in the period.,day,Derived from orders.',
  'ops,runbooks/deploy.md,Runbook,How to ship.,,Run the pipeline.'
].join('\n')

let store: Store
let knowledge: Connection

beforeAll(async () => {
  store = await startStore()
  knowledge = connect(store.dsn)
})

afterAll(() => store.stop())

describe('importing a spreadsheet', () => {
  test('writes one concept per row and the compiler indexes them', async () => {
    const { files, problems } = rowsToConcepts(parseDelimited(SHEET))

    expect(problems).toEqual([])

    const steps = planImport(files, await knowledge.listSource(), false)
    const report = await runImport(knowledge, steps)

    expect(report).toMatchObject({ written: 2, failures: [] })

    const { diagnostics } = await knowledge.sync()
    const rows = parseManifest(await knowledge.manifest()).rows

    expect(rows.map(row => row.id)).toContain('revenue')
    expect(rows.map(row => row.id)).toContain('deploy')
    expect(diagnostics.map(item => item.message)).not.toContain(
      'missing required frontmatter field "type"'
    )
  })

  test('the frontmatter written from columns survives compilation', async () => {
    const revenue = parseManifest(await knowledge.manifest()).rows.find(
      row => row.id === 'revenue'
    )

    expect(revenue?.kind).toBe('metric')
    expect(revenue?.grain).toBe('day')
    expect(revenue?.summary).toBe('Net revenue in the period.')
  })

  test('re-importing skips rather than overwriting silently', async () => {
    const { files } = rowsToConcepts(parseDelimited(SHEET))
    const steps = planImport(files, await knowledge.listSource(), false)

    expect(steps.every(step => step.action === 'skip')).toBe(true)

    const report = await runImport(knowledge, steps)

    expect(report).toMatchObject({ written: 0, skipped: 2 })
  })

  test('re-importing with overwrite carries each observed hash', async () => {
    const { files } = rowsToConcepts(parseDelimited(SHEET))
    const steps = planImport(files, await knowledge.listSource(), true)

    expect(steps.every(step => step.replaces !== undefined)).toBe(true)
    expect(await runImport(knowledge, steps)).toMatchObject({ written: 2 })
  })
})

describe('exporting and re-importing an archive', () => {
  test('a packed bundle unpacks to the same bytes the server holds', async () => {
    const entries = await knowledge.listSource()
    const files = []

    for (const entry of entries) {
      const found = await knowledge.readSource(entry.bundle, entry.path)

      files.push({
        name: `${entry.bundle}/${entry.path}`,
        content: found?.content ?? ''
      })
    }

    const restored = unpackOkf(packOkf(files))

    expect(restored).toEqual(
      [...files].sort((a, b) => (a.name < b.name ? -1 : 1))
    )
  })
})
