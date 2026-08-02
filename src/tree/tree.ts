import type { SourceEntry } from 'langonrock/client'

export type NodeKind = 'bundle' | 'folder' | 'concept' | 'file'

export interface TreeNode {
  name: string
  /** Bundle-relative for anything inside a bundle, empty for a bundle itself. */
  path: string
  bundle: string
  kind: NodeKind
  /**
   * The manifest id this file compiles to. Absent means the compiler treats
   * the file as navigation rather than knowledge, which is `index.md` and
   * `log.md` and nothing else.
   */
  id?: string
  children: TreeNode[]
}

function byKindThenName(a: TreeNode, b: TreeNode): number {
  const folder = (node: TreeNode) => (node.kind === 'folder' ? 0 : 1)

  return folder(a) - folder(b) || a.name.localeCompare(b.name)
}

function childFolder(parent: TreeNode, name: string): TreeNode {
  const existing = parent.children.find(
    node => node.kind === 'folder' && node.name === name
  )

  if (existing !== undefined) {
    return existing
  }

  const created: TreeNode = {
    name,
    path: parent.path === '' ? name : `${parent.path}/${name}`,
    bundle: parent.bundle,
    kind: 'folder',
    children: []
  }

  parent.children.push(created)

  return created
}

function insert(root: TreeNode, entry: SourceEntry): void {
  const segments = entry.path.split('/')
  const name = segments.pop() ?? entry.path
  const parent = segments.reduce(childFolder, root)

  parent.children.push({
    name,
    path: entry.path,
    bundle: entry.bundle,
    // Frontmatter stopped deciding this: plain markdown compiles to a concept
    // now, so the only files left without an id are OKF navigation. Showing
    // them as ordinary files is how they appear as what they are instead of
    // vanishing from the tree with no explanation.
    kind: entry.id === undefined ? 'file' : 'concept',
    ...(entry.id === undefined ? {} : { id: entry.id }),
    children: []
  })
}

function sortDeep(node: TreeNode): void {
  node.children.sort(byKindThenName)
  node.children.forEach(sortDeep)
}

export function buildTree(entries: SourceEntry[]): TreeNode[] {
  const bundles = new Map<string, TreeNode>()

  for (const entry of entries) {
    let root = bundles.get(entry.bundle)

    if (root === undefined) {
      root = {
        name: entry.bundle,
        path: '',
        bundle: entry.bundle,
        kind: 'bundle',
        children: []
      }
      bundles.set(entry.bundle, root)
    }

    insert(root, entry)
  }

  const roots = [...bundles.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  roots.forEach(sortDeep)

  return roots
}

export function findByConceptId(
  roots: TreeNode[],
  id: string
): TreeNode | undefined {
  for (const node of roots) {
    if (node.id === id) {
      return node
    }

    const found = findByConceptId(node.children, id)

    if (found !== undefined) {
      return found
    }
  }

  return undefined
}
