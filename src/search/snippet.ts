const WORD = /[\p{L}\p{N}]+/gu

const LEAD = 3

/**
 * The window a `pos` offset opens is two thousand characters and a result row
 * has space for a couple of hundred, so the passage has to be cut down around
 * the words the reader asked for. The server already chose which part of the
 * document to send; this only chooses which part of that to show, which is why
 * matching is a literal case-insensitive scan rather than anything resembling
 * a second ranker.
 */
export function snippetAround(
  text: string,
  query: string,
  width: number
): string {
  const flat = text.replace(/\s+/g, ' ').trim()

  if (flat === '') {
    return ''
  }

  const lowered = flat.toLowerCase()
  const found = (query.toLowerCase().match(WORD) ?? [])
    .map(word => lowered.indexOf(word))
    .filter(index => index !== -1)

  // A third of the way in rather than centred: the words after a match are
  // usually what explains it, and the ones before it are usually mid-sentence.
  const at = found.length === 0 ? 0 : Math.min(...found)
  const start = Math.max(0, at - Math.floor(width / LEAD))
  const end = Math.min(flat.length, start + width)

  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}
