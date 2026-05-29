import type { SortKey } from '../lib/types'

interface Props {
  sortKey: SortKey
  setSortKey: (k: SortKey) => void
  query: string
  setQuery: (q: string) => void
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'ytd', label: 'YTD' },
  { key: 'fromLow', label: 'Off low' },
  { key: 'name', label: 'A–Z' },
]

export default function Filters({ sortKey, setSortKey, query, setQuery }: Props) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-10 border-y border-ink bg-paper/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            Sort by
          </span>
          <div className="flex items-center gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={`border-b-2 px-1 pb-0.5 text-sm font-semibold transition-colors ${
                  sortKey === s.key
                    ? 'border-claret text-claret'
                    : 'border-transparent text-ink-soft hover:text-ink'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or ticker…"
          className="w-full border-b border-ink/40 bg-transparent px-1 py-1 text-sm text-ink placeholder:text-ink-faint focus:border-claret focus:outline-none sm:w-64"
        />
      </div>
    </div>
  )
}
