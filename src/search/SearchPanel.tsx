import { Search } from 'lucide-react'
import { useState } from 'react'

import { isLinkedOnly, parseSearch } from './query.ts'
import { snippetAround } from './snippet.ts'

import type { SearchResult } from './query.ts'

const SNIPPET_WIDTH = 220

interface Props {
  onSearch: (query: string) => Promise<string>
  onPassage: (id: string, offset: number) => Promise<string>
  onSelect: (id: string) => void
}

/**
 * A hit that matched in the body carries the offset of the passage that
 * matched, so the row can show that passage instead of the summary the
 * manifest would have given for any query at all. Each one is its own read,
 * because the offsets differ and a batched `get` takes only one.
 */
async function passagesFor(
  result: SearchResult,
  query: string,
  fetchAt: (id: string, offset: number) => Promise<string>
): Promise<Map<string, string>> {
  const located = result.rows.flatMap(row =>
    row.pos === undefined ? [] : [{ id: row.id, pos: row.pos }]
  )
  const windows = await Promise.all(
    located.map(row => fetchAt(row.id, row.pos).catch(() => ''))
  )

  return new Map(
    located
      .map((row, index): [string, string] => [
        row.id,
        snippetAround(windows[index] ?? '', query, SNIPPET_WIDTH)
      ])
      .filter(([, passage]) => passage !== '')
  )
}

export function SearchPanel({ onSearch, onPassage, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult>()
  const [passages, setPassages] = useState(new Map<string, string>())
  const [error, setError] = useState<string>()

  const run = async () => {
    if (query.trim() === '') {
      return
    }

    try {
      const found = parseSearch(await onSearch(query))

      setResult(found)
      setError(undefined)
      setPassages(await passagesFor(found, query, onPassage))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div className="search">
      <form
        onSubmit={event => {
          event.preventDefault()
          void run()
        }}
      >
        <input
          value={query}
          placeholder="Search concepts"
          onChange={event => setQuery(event.target.value)}
        />
        <button type="submit">
          <Search />
          Search
        </button>
      </form>

      {error === undefined ? null : <p className="warn">{error}</p>}

      {result === undefined ? null : (
        <>
          <p className="hits">
            {result.direct} matched, {result.linked} reached by a link
          </p>
          <ul className="results">
            {result.rows.map((row, index) => (
              <li key={row.id}>
                <button type="button" onClick={() => onSelect(row.id)}>
                  <strong>{row.id}</strong>
                  {isLinkedOnly(result, index) ? (
                    <em className="linked">linked</em>
                  ) : null}
                  <span>{row.summary}</span>
                  {passages.has(row.id) ? (
                    <span className="passage">{passages.get(row.id)}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
