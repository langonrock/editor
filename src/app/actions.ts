import { useCallback, useEffect } from 'react'

import { buildLocalDsn, buildRemoteDsn } from '../connection/dsn.ts'
import { createSnapshotPoller } from '../connection/watch.ts'
import { createSyncScheduler } from '../connection/sync.ts'
import { merge3 } from '../editor/merge.ts'
import { newDocument, openDocument, rebase } from '../editor/document.ts'
import { openSession } from '../connection/session.ts'
import { parseManifest } from '../okf/manifest.ts'
import { pickFolder, startLocal } from '../local/sidecar.ts'
import { saveDocument } from '../editor/save.ts'
import { saveSecret } from '../secrets/keychain.ts'

import type { RefObject } from 'react'
import type { Action, AppState } from './reducer.ts'
import type { EditorDocument } from '../editor/document.ts'
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
  }, [session, dispatch])
}

function useAttach(wiring: Wiring, refresh: () => Promise<void>) {
  const { session, scheduler, dispatch } = wiring

  return useCallback(
    async (dsn: string) => {
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
          entries: live.entries
        })
        await refresh()
      } catch (cause) {
        dispatch({ type: 'failed', error: messageOf(cause) })
      }
    },
    [session, scheduler, dispatch, refresh]
  )
}

export function useConnect(wiring: Wiring, refresh: () => Promise<void>) {
  const { dispatch } = wiring
  const attach = useAttach(wiring, refresh)

  const connectLocal = useCallback(async () => {
    const folder = await pickFolder()

    if (folder === null) {
      return
    }

    dispatch({ type: 'connecting' })

    try {
      const handle = await startLocal(folder)

      await attach(buildLocalDsn(handle.port, handle.token))
    } catch (cause) {
      dispatch({ type: 'failed', error: messageOf(cause) })
    }
  }, [attach, dispatch])

  const connectRemote = useCallback(
    async (host: string, token: string, remember: boolean) => {
      if (remember) {
        await saveSecret(host, token).catch(() => undefined)
      }

      await attach(buildRemoteDsn(host, token))
    },
    [attach]
  )

  return { connectLocal, connectRemote }
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
