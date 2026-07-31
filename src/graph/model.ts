import type { ManifestRow } from '../okf/types.ts'

export interface GraphNode {
  id: string
  bundle: string
  kind: string
  status: string
  summary: string
  /** Inbound plus outbound, which is what node size is drawn from. */
  degree: number
}

export interface GraphEdge {
  source: string
  target: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * A link cell holds ids the compiler already resolved, so a target that is not
 * in the manifest should be impossible. It is dropped rather than trusted:
 * handing a dangling edge to the layout engine throws inside the renderer,
 * which is a far worse failure than a missing line.
 */
export function toGraph(rows: ManifestRow[]): Graph {
  const known = new Set(rows.map(row => row.id))
  const degree = new Map<string, number>()
  const edges: GraphEdge[] = []

  for (const row of rows) {
    for (const target of row.links) {
      if (!known.has(target)) {
        continue
      }

      edges.push({ source: row.id, target })
      degree.set(row.id, (degree.get(row.id) ?? 0) + 1)
      degree.set(target, (degree.get(target) ?? 0) + 1)
    }
  }

  return {
    nodes: rows.map(row => ({
      id: row.id,
      bundle: row.bundle,
      kind: row.kind,
      status: row.status,
      summary: row.summary,
      degree: degree.get(row.id) ?? 0
    })),
    edges
  }
}

/**
 * Links are directed but relatedness is not: a concept that points at this one
 * is as relevant to a reader as one it points to, so expansion follows edges
 * both ways.
 */
export function neighborhood(graph: Graph, id: string, depth: number): Graph {
  const keep = new Set([id])

  for (let step = 0; step < depth; step += 1) {
    // The frontier is frozen for the pass. Growing `keep` while walking the
    // edges lets a node added by this step expand again in the same step, so a
    // depth of one would reach two hops whenever the edge order happened to
    // line up, and the depth control would mean nothing.
    const frontier = new Set(keep)
    const reached: string[] = []

    for (const edge of graph.edges) {
      if (frontier.has(edge.source)) {
        reached.push(edge.target)
      }

      if (frontier.has(edge.target)) {
        reached.push(edge.source)
      }
    }

    reached.forEach(found => keep.add(found))
  }

  return {
    nodes: graph.nodes.filter(node => keep.has(node.id)),
    edges: graph.edges.filter(
      edge => keep.has(edge.source) && keep.has(edge.target)
    )
  }
}
