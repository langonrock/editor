import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The linked package rather than a compiled binary: tests should fail when the
 * server source changes, not when someone forgets to rebuild the sidecar.
 */
const CLI = join(import.meta.dir, '../../node_modules/langonrock/src/cli.ts')

const READY = /on 127\.0\.0\.1:(\d+)/
const TENANT = 'acme'
const READY_TIMEOUT_MS = 30_000

export interface Store {
  dsn: string
  token: string
  /** The OKF Markdown the server compiles from, for out-of-band edits. */
  sourceDir: string
  stop: () => void
}

export interface StoreOptions {
  /** A token without write turns every PUT into a 403. */
  write?: boolean
  /** Omitting sources.json is how a store is read only by configuration. */
  sources?: boolean
}

/**
 * A seed concept exists so the first compile produces a snapshot. A tenant with
 * no snapshot answers every read with a 404, which would make every test look
 * like a routing failure.
 */
async function seed(sourceDir: string): Promise<void> {
  await mkdir(join(sourceDir, 'sales', 'tables'), { recursive: true })
  await writeFile(
    join(sourceDir, 'sales', 'tables', 'orders.md'),
    '---\ntype: BigQuery Table\ndescription: One row per order.\ngrain: order_id\n---\n\nSeeded.\n'
  )
}

async function config(
  dataDir: string,
  sourceDir: string,
  options: StoreOptions
): Promise<string> {
  const token = `test-${Math.random().toString(36).slice(2)}`
  const grant = { tenant: TENANT, write: options.write !== false }

  await writeFile(
    join(dataDir, 'tokens.json'),
    JSON.stringify({ [token]: grant })
  )

  if (options.sources !== false) {
    await writeFile(
      join(dataDir, 'sources.json'),
      JSON.stringify({ [TENANT]: sourceDir })
    )
  }

  return token
}

/**
 * An explicit reader rather than `for await`: with DOM in the TypeScript lib,
 * ReadableStream is not typed as async iterable, and the renderer needs DOM.
 *
 * Draining continues after the port is found, because a full stderr pipe would
 * block the server mid-compile, which looks exactly like a hung test.
 */
function readPort(stderr: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stderr.getReader()
  const decoder = new TextDecoder()

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('langonrock did not report a port in time')),
      READY_TIMEOUT_MS
    )

    void (async () => {
      for (;;) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        const port = READY.exec(decoder.decode(value, { stream: true }))?.[1]

        if (port !== undefined) {
          clearTimeout(timer)
          resolve(Number(port))
        }
      }

      clearTimeout(timer)
      reject(new Error('langonrock exited before it reported a port'))
    })()
  })
}

/**
 * Port 0 lets the kernel choose, so concurrent test files never collide, and
 * the ready line is the only place the chosen port is reported. Reading it is
 * therefore both the port lookup and the readiness signal.
 */
export async function startStore(options: StoreOptions = {}): Promise<Store> {
  const dataDir = await mkdtemp(join(tmpdir(), 'langoneditor-data-'))
  const sourceDir = await mkdtemp(join(tmpdir(), 'langoneditor-src-'))

  await seed(sourceDir)

  const token = await config(dataDir, sourceDir, options)
  const child = Bun.spawn(
    ['bun', CLI, 'serve', '--data', dataDir, '--port', '0'],
    { stdout: 'ignore', stderr: 'pipe' }
  )

  return {
    dsn: `okf+http://127.0.0.1:${await readPort(child.stderr)}?token=${token}`,
    token,
    sourceDir,
    stop: () => child.kill()
  }
}
