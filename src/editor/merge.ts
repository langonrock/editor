export interface MergeResult {
  text: string
  clean: boolean
}

function commonPrefix(all: string[][]): number {
  const shortest = Math.min(...all.map(lines => lines.length))
  let count = 0

  while (count < shortest && all.every(l => l[count] === all[0]?.[count])) {
    count += 1
  }

  return count
}

function commonSuffix(all: string[][], prefix: number): number {
  const room = Math.min(...all.map(lines => lines.length - prefix))
  let count = 0

  while (
    count < room &&
    all.every(l => l.at(l.length - 1 - count) === all[0]?.at(-1 - count))
  ) {
    count += 1
  }

  return count
}

function middle(lines: string[], prefix: number, suffix: number): string[] {
  return lines.slice(prefix, lines.length - suffix)
}

function conflictBlock(mine: string[], theirs: string[]): string[] {
  return ['<<<<<<< yours', ...mine, '=======', ...theirs, '>>>>>>> theirs']
}

/**
 * A line-level three-way merge reduced to the region that actually differs.
 * Whatever the three versions share as a prefix and a suffix is common ground;
 * only what is left can conflict.
 *
 * The deliberate limitation: two edits in genuinely separate parts of a file
 * still collapse into one differing region and are reported as a conflict. That
 * is the safe direction to be wrong in. A cleverer merge that silently
 * interleaves hunks can drop an edit, and losing someone's writing to a merge
 * nobody reviewed is the one outcome worth ruling out.
 */
export function merge3(
  base: string,
  mine: string,
  theirs: string
): MergeResult {
  if (mine === theirs) {
    return { text: mine, clean: true }
  }

  if (mine === base) {
    return { text: theirs, clean: true }
  }

  if (theirs === base) {
    return { text: mine, clean: true }
  }

  const all = [base, mine, theirs].map(text => text.split('\n'))
  const prefix = commonPrefix(all)
  const suffix = commonSuffix(all, prefix)
  const [baseLines = [], mineLines = [], theirLines = []] = all
  const mineMiddle = middle(mineLines, prefix, suffix)
  const theirMiddle = middle(theirLines, prefix, suffix)
  const baseMiddle = middle(baseLines, prefix, suffix)
  const untouchedByMe = mineMiddle.join('\n') === baseMiddle.join('\n')
  const untouchedByThem = theirMiddle.join('\n') === baseMiddle.join('\n')
  const resolved = untouchedByMe ? theirMiddle : mineMiddle
  const clean = untouchedByMe || untouchedByThem

  return {
    text: [
      ...mineLines.slice(0, prefix),
      ...(clean ? resolved : conflictBlock(mineMiddle, theirMiddle)),
      ...mineLines.slice(mineLines.length - suffix)
    ].join('\n'),
    clean
  }
}
