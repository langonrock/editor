/**
 * The layout package ships no types of its own, and @types/cytoscape-fcose does
 * not exist. Declaring it as a cytoscape extension is the whole contract we use.
 */
declare module 'cytoscape-fcose' {
  import type { Ext } from 'cytoscape'

  const fcose: Ext

  export default fcose
}
