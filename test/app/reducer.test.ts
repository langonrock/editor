import { describe, expect, test } from 'bun:test'

import { openDocument } from '../../src/editor/document.ts'
import { canWrite, initialState, reduce } from '../../src/app/reducer.ts'

import type { Action, AppState } from '../../src/app/reducer.ts'
import type { Profile } from '../../src/profiles/profile.ts'

const play = (actions: Action[], from: AppState = initialState): AppState =>
  actions.reduce(reduce, from)

const opened = () =>
  openDocument('sales', 'a.md', { content: 'base\n', hash: 'h1' })

const PROFILE: Profile = {
  kind: 'remote',
  target: 'kb.example.com',
  name: 'kb'
}

const ready = () =>
  play([
    { type: 'connecting' },
    { type: 'connected', access: 'writable', entries: [], profile: PROFILE }
  ])

describe('connecting', () => {
  test('clears a previous error so a retry does not show a stale one', () => {
    const state = play([{ type: 'connecting' }], {
      ...initialState,
      error: 'old'
    })

    expect(state).toMatchObject({ phase: 'connecting', error: undefined })
  })

  test('a failure returns to idle with the reason', () => {
    expect(
      play([{ type: 'connecting' }, { type: 'failed', error: 'nope' }])
    ).toMatchObject({ phase: 'idle', error: 'nope' })
  })

  test('disconnecting forgets everything, including the open document', () => {
    const state = play(
      [{ type: 'opened', document: opened() }, { type: 'disconnected' }],
      ready()
    )

    expect(state).toEqual(initialState)
    expect(state.connection).toBeUndefined()
  })

  test('the live connection is named so the window can offer to switch', () => {
    expect(ready().connection).toEqual(PROFILE)
  })
})

describe('writability', () => {
  test('a read-only store cannot be written to', () => {
    const state = play([
      { type: 'connected', access: 'read-only', entries: [], profile: PROFILE }
    ])

    expect(canWrite(state)).toBe(false)
  })

  test('a read-only token is only learned from a refused write', () => {
    const before = ready()

    expect(canWrite(before)).toBe(true)

    const after = reduce(before, {
      type: 'rejected',
      failure: { kind: 'read-only-token', status: 403, detail: 'nope' }
    })

    expect(canWrite(after)).toBe(false)
  })

  test('an unrelated rejection does not mark the token read-only', () => {
    const after = reduce(ready(), {
      type: 'rejected',
      failure: { kind: 'conflict', status: 412, detail: 'x' }
    })

    expect(canWrite(after)).toBe(true)
    expect(after.notice).toBe('x')
  })
})

describe('the document', () => {
  test('editing then saving clears the dirty state', () => {
    const state = play(
      [
        { type: 'opened', document: opened() },
        { type: 'edited', draft: 'changed\n' },
        { type: 'saved', hash: 'h2' }
      ],
      ready()
    )

    expect(state.document?.baseHash).toBe('h2')
    expect(state.document?.baseText).toBe('changed\n')
  })

  test('an edit with nothing open is ignored rather than crashing', () => {
    expect(
      reduce(ready(), { type: 'edited', draft: 'x' }).document
    ).toBeUndefined()
  })

  test('a save with nothing open is ignored', () => {
    expect(reduce(ready(), { type: 'saved', hash: 'h' })).toEqual(ready())
  })

  test('opening switches to the editor, so the file is actually visible', () => {
    const state = play(
      [
        { type: 'panel', panel: 'graph' },
        { type: 'opened', document: opened() }
      ],
      ready()
    )

    expect(state.panel).toBe('editor')
  })
})

describe('conflicts', () => {
  const conflict = {
    theirs: 'theirs\n',
    theirHash: 'fresh',
    merged: 'merged\n',
    clean: false
  }

  test('resolving replaces the document and drops the conflict', () => {
    const state = play(
      [
        { type: 'opened', document: opened() },
        { type: 'conflict', conflict },
        { type: 'resolved', document: opened() }
      ],
      ready()
    )

    expect(state.conflict).toBeUndefined()
    expect(state.document).toBeDefined()
  })

  test('editing the merge keeps the version that won', () => {
    const state = play(
      [
        { type: 'conflict', conflict },
        { type: 'merging', merged: 'hand edited\n' }
      ],
      ready()
    )

    expect(state.conflict).toEqual({ ...conflict, merged: 'hand edited\n' })
  })

  test('merging with no conflict open is ignored', () => {
    expect(
      reduce(ready(), { type: 'merging', merged: 'x' }).conflict
    ).toBeUndefined()
  })

  test('a successful save clears the conflict', () => {
    const state = play(
      [
        { type: 'opened', document: opened() },
        { type: 'conflict', conflict },
        { type: 'saved', hash: 'h3' }
      ],
      ready()
    )

    expect(state.conflict).toBeUndefined()
  })
})

describe('the listing and the manifest', () => {
  test('a refresh replaces the entries and the rows independently', () => {
    const entry = { bundle: 'sales', path: 'a.md', bytes: 4, hash: 'h' }
    const row = {
      id: 'a',
      bundle: 'sales',
      kind: 'table',
      status: '',
      grain: '',
      summary: 'A.',
      links: []
    }
    const state = play(
      [
        { type: 'entries', entries: [entry] },
        { type: 'manifest', rows: [row] }
      ],
      ready()
    )

    expect(state.entries).toEqual([entry])
    expect(state.rows).toEqual([row])
  })

  test('closing puts the editor back to nothing open', () => {
    const state = play(
      [{ type: 'opened', document: opened() }, { type: 'closed' }],
      ready()
    )

    expect(state.document).toBeUndefined()
  })

  test('a notice can be raised and dismissed', () => {
    const raised = reduce(ready(), { type: 'notice', notice: 'careful' })

    expect(raised.notice).toBe('careful')
    expect(reduce(raised, { type: 'notice' }).notice).toBeUndefined()
  })

  test('switching panel leaves the document alone', () => {
    const state = play(
      [
        { type: 'opened', document: opened() },
        { type: 'panel', panel: 'graph' }
      ],
      ready()
    )

    expect(state.panel).toBe('graph')
    expect(state.document).toBeDefined()
  })
})

describe('staleness and logs', () => {
  test('a sync clears the stale banner and records the lint', () => {
    const state = play(
      [
        { type: 'stale', stale: true },
        {
          type: 'synced',
          diagnostics: [{ level: 'warn', path: 'a.md', message: 'no type' }]
        }
      ],
      ready()
    )

    expect(state.stale).toBe(false)
    expect(state.diagnostics).toHaveLength(1)
  })

  test('logs keep the most recent lines and stop growing', () => {
    const lines: Action[] = Array.from({ length: 600 }, (_, i) => ({
      type: 'log',
      line: `line ${i}`
    }))
    const state = play(lines, ready())

    expect(state.logs).toHaveLength(500)
    expect(state.logs.at(-1)).toBe('line 599')
    expect(state.logs[0]).toBe('line 100')
  })
})
