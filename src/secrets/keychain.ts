import { invoke } from '@tauri-apps/api/core'

/**
 * Keyed by profile rather than by host, so two profiles pointing at the same
 * server with different tokens do not overwrite each other.
 */
export const saveSecret = (account: string, secret: string) =>
  invoke<void>('secret_save', { account, secret })

export const loadSecret = (account: string) =>
  invoke<string | null>('secret_load', { account })

export const deleteSecret = (account: string) =>
  invoke<void>('secret_delete', { account })

/**
 * Linux needs a running Secret Service. Where there is none the app must ask
 * for the token every launch rather than appearing to remember it.
 */
export const keychainAvailable = () => invoke<boolean>('secret_available')
