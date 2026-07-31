/**
 * The editor's own view of OKF. Deliberately free of any import so it can be
 * shared by the renderer, the tests and the transfer code without dragging a
 * transport or a runtime along with it.
 */
export type Frontmatter = Record<string, unknown>

export interface ParsedConcept {
  data: Frontmatter
  body: string
  /** Set when frontmatter was present but unusable, mirroring the compiler. */
  error?: string
}

/** Files are edited in LF and written back in whatever they arrived as. */
export type Eol = '\n' | '\r\n'

export interface ManifestRow {
  id: string
  bundle: string
  kind: string
  status: string
  grain: string
  summary: string
  links: string[]
}

export interface Manifest {
  /** The `# tenant:` and `# bundles:` lines, kept verbatim and in order. */
  comments: string[]
  columns: string[]
  rows: ManifestRow[]
}
