import type { SortKey } from '../lib/types'
import { LENSES, type Lens } from '../lib/brief'

interface Category {
  key: string
  label: string
  color: string
}

interface Props {
  sortKey: SortKey
  setSortKey: (k: SortKey) => void
  query: string
  setQuery: (q: string) => void
  lens: Lens
  setLens: (l: Lens) => void
  category: string
  setCategory: (c: string) => void
  categories: Category[]
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'ytd', label: 'YTD' },
  { key: 'fromLow', label: 'Off low' },
  { key: 'rule40', label: 'Rule of 40' },
  { key: 'name', label: 'A–Z' },
]

export default function Filters({
  sortKey,
  setSortKey,
  query,
  setQuery,
  lens,
  setLens,
  category,
  setCategory,
  categories,
}: Props) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mb-10 border-y border-ink bg-paper/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex max-w-5xl flex-col gap-2.5">
        {/* Row 1 — sort + search */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            className="w-full border-b border-ink/40 bg-transparent px-1 py-1 text-sm text-ink placeholder:text-ink-faint focus:border-claret focus:outline-none sm:w-56"
          />
        </div>

        {/* Row 2 — Rule-of-40 lenses + category */}
        <div className="flex flex-col gap-2 border-t border-rule pt-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
              Lens
            </span>
            {LENSES.map((l) => (
              <button
                key={l.key}
                onClick={() => setLens(l.key)}
                title={l.hint}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  lens === l.key
                    ? 'border-claret bg-claret text-paper'
                    : 'border-rule text-ink-soft hover:border-ink/40 hover:text-ink'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
              Category
            </span>
            <CatChip active={category === 'all'} onClick={() => setCategory('all')}>
              All
            </CatChip>
            {categories.map((c) => (
              <CatChip key={c.key} active={category === c.key} color={c.color} onClick={() => setCategory(c.key)}>
                {c.label}
              </CatChip>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CatChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
        active ? 'border-ink bg-ink text-paper' : 'border-rule text-ink-soft hover:border-ink/40 hover:text-ink'
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </button>
  )
}
