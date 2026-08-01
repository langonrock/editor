import { Search } from 'lucide-react'
import { useState } from 'react'

import { isLinkedOnly, parseSearch } from './query.ts'

import type { SearchResult } from './query.ts'

interface Props {
  onSearch: (query: string) => Promise<string>
  onSelect: (id: string) => void
}

export function SearchPanel({ onSearch, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult>()
  const [error, setError] = useState<string>()

  const run = async () => {
    if (query.trim() === '') {
      return
    }

    try {
      setResult(parseSearch(await onSearch(query)))
      setError(undefined)
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
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
