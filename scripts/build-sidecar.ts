#!/usr/bin/env bun
import { $ } from 'bun'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Tauri resolves a sidecar by appending the Rust host triple to the configured
 * name, so the file has to be called exactly this. Bun names the same platforms
 * differently, which is the only reason this table exists.
 */
const BUN_TARGET: Record<string, string> = {
  'aarch64-apple-darwin': 'bun-darwin-arm64',
  'x86_64-apple-darwin': 'bun-darwin-x64',
  'x86_64-unknown-linux-gnu': 'bun-linux-x64',
  'aarch64-unknown-linux-gnu': 'bun-linux-arm64',
  'x86_64-pc-windows-msvc': 'bun-windows-x64'
}

const ROOT = join(import.meta.dir, '..')
const LANGONROCK = join(ROOT, 'node_modules', 'langonrock')
const OUT_DIR = join(ROOT, 'src-tauri', 'binaries')

async function hostTriple(): Promise<string> {
  const info = await $`rustc -Vv`.text()
  const host = /^host:\s*(\S+)$/m.exec(info)?.[1]

  if (host === undefined) {
    throw new Error('could not read the host triple from `rustc -Vv`')
  }

  return host
}

/**
 * Built from the linked source rather than downloaded from a release, so the
 * sidecar always matches the client the renderer is compiled against. A version
 * skew between the two is invisible until a verb the editor calls is missing.
 */
async function build(triple: string): Promise<string> {
  const target = BUN_TARGET[triple]

  if (target === undefined) {
    throw new Error(
      `no bun target for ${triple}: known triples are ${Object.keys(BUN_TARGET).join(', ')}`
    )
  }

  const suffix = triple.includes('windows') ? '.exe' : ''
  const outfile = join(OUT_DIR, `langonrock-${triple}${suffix}`)

  await mkdir(OUT_DIR, { recursive: true })
  // langonrock's own build script owns the macOS codesign fixup for Bun #29361,
  // without which the kernel kills the binary before it runs.
  await $`bun scripts/build.ts --target=${target} --outfile=${outfile}`.cwd(
    LANGONROCK
  )

  return outfile
}

const triple = Bun.argv[2] ?? (await hostTriple())
const outfile = await build(triple)

console.error(`sidecar: ${outfile}`)
