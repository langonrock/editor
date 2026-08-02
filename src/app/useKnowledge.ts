import { useReducer, useRef } from 'react'

import { initialState, reduce } from './reducer.ts'
import {
  useConnect,
  useDisconnect,
  useOpen,
  usePassage,
  usePersist,
  useRefresh,
  useReload,
  useRemove,
  useResolve,
  useSearch,
  useStalePoller
} from './actions.ts'

import type { Session } from '../connection/session.ts'
import type { SyncScheduler } from '../connection/sync.ts'
import type { Wiring } from './actions.ts'

/**
 * The session and the scheduler live in refs rather than in the reducer: they
 * are handles, not state, and putting a live connection in a value that gets
 * copied on every action would be a good way to leak one.
 */
export function useKnowledge() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const session = useRef<Session | null>(null)
  const scheduler = useRef<SyncScheduler | null>(null)
  const wiring: Wiring = { session, scheduler, dispatch }

  const refresh = useRefresh(wiring)
  const persist = usePersist(wiring)

  useStalePoller(wiring, state.phase)

  return {
    state,
    dispatch,
    connect: useConnect(wiring, refresh),
    disconnect: useDisconnect(wiring),
    refresh,
    reload: useReload(wiring, refresh),
    persist,
    open: useOpen(wiring),
    resolve: useResolve(wiring, persist),
    remove: useRemove(wiring),
    search: useSearch(wiring),
    passage: usePassage(wiring),
    knowledge: () => session.current?.knowledge
  }
}
