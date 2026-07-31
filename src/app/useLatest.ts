import { useEffect, useRef } from 'react'

/**
 * Keeps the newest callback reachable from an effect that must not re-run.
 * CodeMirror and cytoscape are both expensive to rebuild and hold state the
 * user cares about — a cursor, a pan and zoom — so their effects depend on the
 * data and read the handler through this instead of listing it as a dependency.
 *
 * The assignment happens in an effect rather than during render, because a
 * render that React later discards would otherwise leave the ref pointing at a
 * callback that was never committed.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref
}
