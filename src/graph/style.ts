import type { StylesheetJson } from 'cytoscape'

/**
 * Deprecated concepts are dimmed rather than hidden. A link into something on
 * its way out is exactly what a reader needs to notice.
 */
export const GRAPH_STYLE: StylesheetJson = [
  {
    selector: 'node',
    style: {
      label: 'data(id)',
      'font-size': 9,
      color: '#c9d1d9',
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'background-color': '#4c8eda',
      width: 'mapData(degree, 0, 12, 10, 34)',
      height: 'mapData(degree, 0, 12, 10, 34)'
    }
  },
  {
    selector: 'node[status = "deprecated"]',
    style: { 'background-color': '#8b949e', opacity: 0.5 }
  },
  {
    selector: 'node:selected',
    style: { 'background-color': '#f0883e', 'border-width': 2 }
  },
  {
    selector: 'edge',
    style: {
      width: 1,
      'line-color': '#30363d',
      'target-arrow-color': '#30363d',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 0.7
    }
  }
]

export const LAYOUT = {
  name: 'fcose',
  quality: 'default',
  animate: false,
  randomize: true,
  nodeSeparation: 90,
  idealEdgeLength: 70
}
