import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { useEffect, useRef } from 'react'

import { LAYOUT, graphStyle } from './style.ts'
import { toGraph } from './model.ts'
import { useLatest } from '../app/useLatest.ts'
import { useTheme } from '../app/theme.ts'

import type { ManifestRow } from '../okf/types.ts'

cytoscape.use(fcose)

interface Props {
  rows: ManifestRow[]
  onSelect: (id: string) => void
}

export function GraphView({ rows, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<cytoscape.Core>(null)
  const select = useLatest(onSelect)
  const dark = useTheme() === 'dark'

  useEffect(() => {
    if (host.current === null || rows.length === 0) {
      return
    }

    const graph = toGraph(rows)
    const instance = cytoscape({
      container: host.current,
      style: graphStyle(dark),
      layout: LAYOUT,
      elements: [
        ...graph.nodes.map(node => ({ data: { ...node } })),
        ...graph.edges.map(edge => ({
          data: { id: `${edge.source}->${edge.target}`, ...edge }
        }))
      ]
    })

    instance.on('tap', 'node', event => {
      select.current(String(event.target.id()))
    })

    view.current = instance

    // Cleared as well as destroyed: emptying the manifest re-runs this effect
    // into its early return, and a restyle would then reach a dead instance.
    return () => {
      view.current = null
      instance.destroy()
    }
    // The palette is seeded here and reapplied below. Rebuilding on a theme
    // change would run the layout again, and it is randomized, so the reader
    // would lose the arrangement they were reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, select])

  useEffect(() => {
    view.current?.style(graphStyle(dark))
  }, [dark])

  if (rows.length === 0) {
    return <p className="empty small">Nothing compiled yet.</p>
  }

  return <div className="graph" ref={host} />
}
