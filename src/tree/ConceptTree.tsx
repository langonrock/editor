import { File, FileText, Folder, Package } from 'lucide-react'

import { buildTree } from './tree.ts'

import type { LucideIcon } from 'lucide-react'
import type { TreeNode } from './tree.ts'
import type { SourceEntry } from 'langonrock/client'

interface Props {
  entries: SourceEntry[]
  selected?: string | undefined
  onOpen: (bundle: string, path: string) => void
}

const ICON: Record<TreeNode['kind'], LucideIcon> = {
  bundle: Package,
  folder: Folder,
  concept: FileText,
  file: File
}

function Node({
  node,
  selected,
  onOpen
}: {
  node: TreeNode
  selected: string | undefined
  onOpen: Props['onOpen']
}) {
  const key = `${node.bundle}/${node.path}`
  const isLeaf = node.kind === 'concept' || node.kind === 'file'
  const Glyph = ICON[node.kind]

  return (
    <li>
      <button
        type="button"
        className={selected === key && isLeaf ? 'node selected' : 'node'}
        // A file with no id carries no frontmatter, so the compiler ignored it.
        // It stays clickable: seeing why it is not a concept is the point.
        title={node.kind === 'file' ? 'not a concept: no frontmatter' : node.id}
        onClick={() => isLeaf && onOpen(node.bundle, node.path)}
      >
        <span className={`icon ${node.kind}`}>
          <Glyph />
        </span>
        {node.name}
      </button>
      {node.children.length === 0 ? null : (
        <ul>
          {node.children.map(child => (
            <Node
              key={`${child.bundle}/${child.path}/${child.name}`}
              node={child}
              selected={selected}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function ConceptTree({ entries, selected, onOpen }: Props) {
  const roots = buildTree(entries)

  if (roots.length === 0) {
    return (
      <p className="empty small">
        No concepts found. A bundle is a folder directly inside the one you
        picked, and concepts are the <code>.md</code> files inside it.
      </p>
    )
  }

  return (
    <ul className="tree">
      {roots.map(root => (
        <Node
          key={root.bundle}
          node={root}
          selected={selected}
          onOpen={onOpen}
        />
      ))}
    </ul>
  )
}
