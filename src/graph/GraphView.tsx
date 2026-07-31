import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { useEffect, useRef } from 'react'

import { GRAPH_STYLE, LAYOUT } from './style.ts'
import { toGraph } from './model.ts'
import { useLatest } from '../app/useLatest.ts'

import type { ManifestRow } from '../okf/types.ts'

cytoscape.use(fcose)

interface Props {
  rows: ManifestRow[]
  onSelect: (id: string) => void
}

export function GraphView({ rows, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const select = useLatest(onSelect)

  useEffect(() => {
    if (host.current === null || rows.length === 0) {
      return
    }

    const graph = toGraph(rows)
    const instance = cytoscape({
      container: host.current,
      style: GRAPH_STYLE,
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

    return () => instance.destroy()
  }, [rows, select])

  if (rows.length === 0) {
    return <p className="empty small">Nothing compiled yet.</p>
  }

  return <div className="graph" ref={host} />
}
