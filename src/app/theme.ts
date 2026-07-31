import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'langoneditor.theme'

const listeners = new Set<() => void>()

let current: Theme = localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'

/**
 * One store rather than a prop threaded through the tree, because the two
 * things that cannot read the palette from CSS — CodeMirror, which picks a
 * caret colour, and cytoscape, which paints to a canvas — sit at the far end of
 * it. Applied on import so a remembered theme is in place before the first
 * paint.
 */
function apply(theme: Theme): void {
  current = theme
  document.documentElement.dataset.theme = theme
}

apply(current)

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function toggleTheme(): void {
  apply(current === 'dark' ? 'light' : 'dark')
  localStorage.setItem(KEY, current)
  listeners.forEach(listener => listener())
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => current)
}
