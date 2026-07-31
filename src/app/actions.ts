import { useCallback, useEffect } from 'react'

import { buildLocalDsn, buildRemoteDsn } from '../connection/dsn.ts'
import { createSnapshotPoller } from '../connection/watch.ts'
import { createSyncScheduler } from '../connection/sync.ts'
import {
  canReload,
  newDocument,
  openDocument,
  rebase
} from '../editor/document.ts'
import { merge3 } from '../editor/merge.ts'
import { loadSecret, saveSecret } from '../secrets/keychain.ts'
import { openSession } from '../connection/session.ts'
import { parseManifest } from '../okf/manifest.ts'
import { profileId } from '../profiles/profile.ts'
import { saveDocument } from '../editor/save.ts'
import { startLocal, stopLocal } from '../local/sidecar.ts'

import type { RefObject } from 'react'
import type { Action, AppState } from './reducer.ts'
import type { EditorDocument } from '../editor/document.ts'
import type { Profile } from '../profiles/profile.ts'
import type { Session } from '../connection/session.ts'
import type { SyncScheduler } from '../connection/sync.ts'

const TEMPLATE = '---\ntype: \ndescription: \n---\n\n'

export interface Wiring {
  session: RefObject<Session | null>
  scheduler: RefObject<SyncScheduler | null>
  dispatch: (action: Action) => void
}

export function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export function useRefresh({ session, dispatch }: Wiring) {
  return useCallback(async () => {
    const live = session.current

    if (live === null) {
      return
    }

    dispatch({ type: 'entries', entries: await live.knowledge.listSource() })

    try {
      const tsv = await live.knowledge.manifest()

      dispatch({ type: 'manifest', rows: parseManifest(tsv).rows })
    } catch {
      // A tenant whose first concept has not compiled yet has no manifest at
      // all, which is a normal empty state rather than a connection problem.
      dispatch({ type: 'manifest', rows: [] })
    }

    // Everything on screen now came from the server, so the stale banner has
    // been answered. Nothing else clears it on this path — `synced` only fires
    // for a sync this app asked for — and a banner still up after its own
    // button was pressed reads as a button that does nothing.
    dispatch({ type: 'stale', stale: false })
  }, [session, dispatch])
}

async function reopen(
  live: Session | null,
  document: EditorDocument | undefined,
  dispatch: (action: Action) => void
): Promise<void> {
  if (live === null || !canReload(document)) {
    return
  }

  const found = await live.knowledge.readSource(document.bundle, document.path)

  // Gone from the store rather than changed. The tree already says so, and
  // closing the pane out from under the reader would hide what it was.
  if (found !== undefined) {
    dispatch({
      type: 'reloaded',
      document: openDocument(document.bundle, document.path, found)
    })
  }
}

/**
 * What the banner's button does. `refresh` catches up the tree, the graph and
 * the banner itself; the open file is the other half, and the half the reader
 * is actually looking at. Without it the editor keeps showing text the store no
 * longer holds, against a hash the next save would be refused for.
 */
export function useReload(wiring: Wiring, refresh: () => Promise<void>) {
  const { session, dispatch } = wiring

  return useCallback(
    async (document?: EditorDocument) => {
      try {
        await refresh()
        await reopen(session.current, document, dispatch)
      } catch (cause) {
        // Reload is the one action with no other visible outcome, so a failure
        // that only rejected a promise would look exactly like success.
        dispatch({ type: 'notice', notice: messageOf(cause) })
      }
    },
    [session, dispatch, refresh]
  )
}

function useAttach(wiring: Wiring, refresh: () => Promise<void>) {
  const { session, scheduler, dispatch } = wiring

  return useCallback(
    async (dsn: string, profile: Profile) => {
      dispatch({ type: 'connecting' })

      try {
        const live = await openSession(dsn)

        session.current = live
        scheduler.current = createSyncScheduler(live.knowledge, {
          onResult: result => {
            dispatch({ type: 'synced', diagnostics: result.diagnostics })
            void refresh()
          },
          onError: cause =>
            dispatch({ type: 'notice', notice: messageOf(cause) })
        })

        dispatch({
          type: 'connected',
          access: live.access,
          entries: live.entries,
          profile
        })
        await refresh()
      } catch (cause) {
        dispatch({ type: 'failed', error: messageOf(cause) })
      }
    },
    [session, scheduler, dispatch, refresh]
  )
}

/**
 * A saved connection carries no token, so reopening one reads it back out of
 * the keychain. Only a token typed just now is written, and a keychain that
 * refuses to store is not a reason to refuse to connect.
 */
async function dsnFor(
  profile: Profile,
  token: string | undefined,
  remember: boolean
): Promise<string> {
  if (profile.kind === 'local') {
    const handle = await startLocal(profile.target)

    return buildLocalDsn(handle.port, handle.token)
  }

  const account = profileId(profile)
  const secret = token ?? (await loadSecret(account))

  if (secret === null || secret === '') {
    throw new Error('no token is saved for this connection: enter one below')
  }

  if (token !== undefined && remember) {
    await saveSecret(account, token).catch(() => undefined)
  }

  return buildRemoteDsn(profile.target, secret)
}

export function useConnect(wiring: Wiring, refresh: () => Promise<void>) {
  const { dispatch } = wiring
  const attach = useAttach(wiring, refresh)

  return useCallback(
    async (profile: Profile, token?: string, remember = true) => {
      dispatch({ type: 'connecting' })

      try {
        await attach(await dsnFor(profile, token, remember), profile)
      } catch (cause) {
        dispatch({ type: 'failed', error: messageOf(cause) })
      }
    },
    [attach, dispatch]
  )
}

export function useDisconnect({ session, scheduler, dispatch }: Wiring) {
  return useCallback(async () => {
    scheduler.current?.close()
    scheduler.current = null
    await session.current?.close().catch(() => undefined)
    session.current = null
    // A no-op when the connection was remote: the supervisor stops whatever it
    // is holding, and for a remote session that is nothing.
    await stopLocal().catch(() => undefined)
    dispatch({ type: 'disconnected' })
  }, [session, scheduler, dispatch])
}

export function useOpen({ session, dispatch }: Wiring) {
  return useCallback(
    async (bundle: string, path: string) => {
      const live = session.current

      if (live === null) {
        return
      }

      const found = await live.knowledge.readSource(bundle, path)

      dispatch({
        type: 'opened',
        document:
          found === undefined
            ? newDocument(bundle, path, TEMPLATE)
            : openDocument(bundle, path, found)
      })
    },
    [session, dispatch]
  )
}

export function usePersist({ session, scheduler, dispatch }: Wiring) {
  return useCallback(
    async (document: EditorDocument) => {
      const live = session.current

      if (live === null) {
        return
      }

      const outcome = await saveDocument(live.knowledge, document)

      if (outcome.kind === 'saved') {
        dispatch({ type: 'saved', hash: outcome.hash })
        scheduler.current?.request()

        return
      }

      if (outcome.kind === 'rejected') {
        dispatch({ type: 'rejected', failure: outcome.failure })

        return
      }

      const merged = merge3(document.baseText, document.draft, outcome.theirs)

      dispatch({
        type: 'conflict',
        conflict: { ...outcome, merged: merged.text, clean: merged.clean }
      })
    },
    [session, scheduler, dispatch]
  )
}

export function useResolve(
  wiring: Wiring,
  persist: (document: EditorDocument) => Promise<void>
) {
  const { dispatch } = wiring

  return useCallback(
    async (document: EditorDocument, theirHash: string, text: string) => {
      // Rebased onto the hash just observed, never the one that was refused,
      // so the retry cannot fail for the same reason twice.
      const rebased = rebase(document, text, theirHash, text)

      dispatch({ type: 'resolved', document: rebased })
      await persist(rebased)
    },
    [dispatch, persist]
  )
}

export function useRemove({ session, scheduler, dispatch }: Wiring) {
  return useCallback(
    async (document: EditorDocument) => {
      const live = session.current

      if (live === null || document.baseHash === undefined) {
        return
      }

      try {
        await live.knowledge.deleteSource(
          document.bundle,
          document.path,
          document.baseHash
        )
        dispatch({ type: 'closed' })
        scheduler.current?.request()
      } catch (cause) {
        dispatch({ type: 'notice', notice: messageOf(cause) })
      }
    },
    [session, scheduler, dispatch]
  )
}

export function useSearch({ session }: Wiring) {
  return useCallback(
    (query: string) => {
      const live = session.current

      if (live === null) {
        throw new Error('not connected')
      }

      return live.knowledge.search(query)
    },
    [session]
  )
}

/**
 * Nothing pushes from the server, so noticing an edit made in Obsidian means
 * asking. `snapshot` is a tiny response; `listSource` would read and hash every
 * file on every poll.
 */
export function useStalePoller(wiring: Wiring, phase: AppState['phase']) {
  const { session, dispatch } = wiring

  useEffect(() => {
    if (phase !== 'ready' || session.current === null) {
      return
    }

    const poller = createSnapshotPoller(session.current.knowledge, {
      onChange: () => dispatch({ type: 'stale', stale: true })
    })

    return () => poller.stop()
  }, [phase, session, dispatch])
}
