import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export interface LocalHandle {
  port: number
  token: string
  tenant: string
  store: string
}

export interface PickedFile {
  name: string
  bytes: number[]
}

/**
 * Starting is idempotent from the caller's side: the supervisor stops whatever
 * was running first, because sources.json holds exactly one folder and a stale
 * watcher would take the next start down before it binds.
 */
export const startLocal = (folder: string) =>
  invoke<LocalHandle>('local_start', { folder })

export const stopLocal = () => invoke<void>('local_stop')

export const pickFolder = () => invoke<string | null>('pick_folder')

export const pickAndRead = (extensions: string[]) =>
  invoke<PickedFile | null>('pick_and_read', { extensions })

export const pickAndWrite = (name: string, bytes: number[]) =>
  invoke<boolean>('pick_and_write', { name, bytes })

/** The server's stderr is the only channel carrying compile progress. */
export const onSidecarLog = (handler: (line: string) => void) =>
  listen<string>('sidecar-log', event => handler(event.payload))
