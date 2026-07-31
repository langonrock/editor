import type { SourceEntry } from 'langonrock/client'

export type NodeKind = 'bundle' | 'folder' | 'concept' | 'file'

export interface TreeNode {
  name: string
  /** Bundle-relative for anything inside a bundle, empty for a bundle itself. */
  path: string
  bundle: string
  kind: NodeKind
  /** The manifest id this file compiles to. Absent means it is not a concept. */
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
    // A file with no id carries no frontmatter, so the compiler skipped it.
    // Showing it as an ordinary file is how a cloned repo's README appears as
    // what it is instead of vanishing with no explanation.
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
