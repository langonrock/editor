# langoneditor

[![ci](https://github.com/langonrock/editor/actions/workflows/ci.yml/badge.svg)](https://github.com/langonrock/editor/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A desktop editor, visualizer, importer and exporter for [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog) knowledge bundles. Runs on macOS (Apple silicon and Intel), Windows and Linux.

OKF is a directory of Markdown files with YAML frontmatter. [langonrock](https://github.com/langonrock/langonrock) compiles any folder of Markdown into a dense manifest and serves it over HTTP, with frontmatter as the conformance bar rather than the price of admission. This app is the human-facing half: browse the tree, edit concepts, see the link graph, search, and move bundles in and out as archives or spreadsheets.

Everything the compiler knows stays in the compiler. The editor derives no ids, resolves no links and reproduces no lint rules — it asks the server and shows the answer, so the two cannot drift apart.

## What it does

- **Edit** concepts as plain Markdown, with a form for the frontmatter fields the compiler keeps. Untouched keys — `tags`, nested `sources`, comments — survive byte for byte.
- **Visualize** the link graph, sized by degree, and jump from a node straight to the file it compiled from.
- **Search** with the server's BM25 index, showing which hits matched, which were reached by a link, and the passage inside each hit that the query landed on.
- **Import and export** a whole bundle as a zip, or a set of concepts as CSV/TSV.
- **Show the compiler's lint** — a missing `type`, an unresolved link, a file compiled without frontmatter — as reported by the server rather than reproduced here.

## Install

Download the artifact for your platform from [Releases](https://github.com/langonrock/editor/releases). Nothing else is required: the langonrock server ships inside the app.

| Platform               | File                                    |
| ---------------------- | --------------------------------------- |
| macOS (Apple silicon)  | `langoneditor_<version>_aarch64.dmg`    |
| macOS (Intel)          | `langoneditor_<version>_x64.dmg`        |
| Windows                | `langoneditor_<version>_x64-setup.exe`  |
| Linux (Debian, Ubuntu) | `langoneditor_<version>_amd64.deb`      |
| Linux (other)          | `langoneditor_<version>_amd64.AppImage` |

Releases are not code-signed yet, so the first launch needs one extra step: on macOS, right-click the app and choose **Open** rather than double-clicking; on Windows, choose **More info → Run anyway** at the SmartScreen prompt. Signing is a matter of certificates, not of code — see [packaging notes](#packaging-notes).

## Connecting

**A local folder.** Pick the directory holding your bundles. The app starts its own `langonrock serve` on loopback with a freshly generated token and keeps its store under the OS application data directory. Your own langonrock store is never written to.

**A remote server.** Enter the host and a bearer token. Anything but a loopback address must be `https`, because the token would otherwise cross the network in clear text. langonrock does not serve TLS itself, so terminate it at a reverse proxy (Caddy, nginx, Cloudflare). Tokens are kept in the system keychain when one is available.

**Saved connections.** Both kinds are remembered by name, most recently used first, and reopening one is a click. Only the name and the folder or host are stored; the token stays in the keychain and is read back when you connect. The name of the live connection sits in the toolbar, and clicking it disconnects and returns to the list — that is how you switch. Two connections may share a host and carry different tokens, so a read-only login and a writable one can live side by side.

A token that may read but not write is not visible until a save is refused — the source listing does not check writability. The app reports that state when it learns it. A store with no `sources.json` is read-only from the moment you connect, and is reported immediately.

Bundles must be laid out as `<folder>/<bundle>/<concept>.md`. Markdown sitting at the top level of the folder compiles to nothing.

## Concurrency

Every write names the version it replaces. If someone edited the same concept — in another window, or in Obsidian alongside — the server refuses the write and the app shows a three-way merge instead of overwriting. All three resolutions rebase onto the version just observed, so a retry cannot fail for the same reason twice.

The app polls the snapshot digest every few seconds and warns when the store moves under it.

## Development

Requires [Bun](https://bun.sh) ≥ 1.3 and a Rust toolchain. Linux additionally needs the WebKitGTK development packages listed in [`ci.yml`](.github/workflows/ci.yml).

langonrock is consumed as a local link:

```sh
git clone git@github.com:langonrock/langonrock.git ../langonrock
cd ../langonrock && bun install && bun link
cd ../langoneditor && bun install
```

Then:

```sh
bun run sidecar     # compile langonrock into src-tauri/binaries/
bun run tauri dev   # run the app
```

| Command                                           | Does                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `bun test`                                        | Unit and integration tests, with coverage                                        |
| `bun run lint` / `format:check` / `typecheck`     | The JavaScript gates                                                             |
| `cargo test --manifest-path src-tauri/Cargo.toml` | The Rust gates                                                                   |
| `bun run sidecar [triple]`                        | Build the langonrock sidecar for the host, or for an explicit Rust target triple |
| `bun run tauri build`                             | Produce `.dmg`, NSIS `.exe`, `.deb` and `.AppImage`                              |

Integration tests spawn a real `langonrock serve` from the linked source, so they fail when the server's contract changes rather than when a binary is stale.

## Layout

```
src/
  okf/          frontmatter, line endings, path rules — depends on nothing
  connection/   the https gate, error classification, the fetch seam, sync, polling
  editor/       document state, write preconditions, three-way merge
  tree/         the bundle and concept tree
  graph/        the link graph
  search/       ranked hits and their link neighbourhood
  transfer/     zip and delimited-text import and export
  app/          window, reducer, connect dialog, diagnostics
src-tauri/      Rust: sidecar supervisor, keychain, file dialogs
scripts/        sidecar build
test/           mirrors src/, plus integration against a real server
```

Dependencies run one way and never cycle: `okf/` imports nothing, `connection/` imports `okf/` and the langonrock client, the feature folders import both, and `app/` sits on top of everything.

Anything that can be a pure function lives in a `.ts` file rather than a `.tsx` one — which is why `save.ts`, `merge.ts`, `tree.ts`, `model.ts`, `zipplan.ts`, `csvimport.ts` and `reducer.ts` are separate modules from the components that render them. State transitions are unit-tested, not clicked.

## Packaging notes

- **macOS.** The sidecar embeds the Bun runtime, which JITs. `src-tauri/Entitlements.plist` grants `allow-jit` and `allow-unsigned-executable-memory`; without them a notarized build is killed at launch for users while working in development. Signing and notarization need an Apple Developer ID.
- **Bundle size.** The sidecar is ~62 MB per architecture, so macOS artifacts are arch-specific rather than universal.
- **CI.** Both workflows check out langonrock as a sibling and link it, which needs a `LANGONROCK_TOKEN` secret while that repository is private. Publishing langonrock to a registry would remove the step and the secret.

## Known limitations

- The three-way merge reduces to the single region that differs, so two edits in genuinely separate parts of a file are still reported as a conflict. That is the safe direction: a merge that interleaves hunks can silently drop an edit.
- `parseDsn` in langonrock discards the URL path, so a server mounted at `https://host/okf/` behind a proxy is not reachable. Mount it at the origin root.
- A failed compile is reported by the server as HTTP 404, so a malformed concept reads as "not found".
- The behaviour of Tauri's HTTP plugin around `204` responses carrying an `ETag`, and around request headers such as `If-Match`, is the one link no automated test in this repo covers — it needs a running app. **Connection → Check this connection** in the diagnostics panel runs those four assertions against the store you are connected to, and `src/connection/fetch.ts` is a one-file seam so the backend can be swapped for a Rust `reqwest` command without touching anything else.

## License

[MIT](LICENSE) © Henrique Breim
