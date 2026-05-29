import type { Bucket, SortKey } from '../lib/types'
import { sortCompanies, median, pct } from '../lib/format'
import CompanyRow from './CompanyRow'

interface Props {
  id: string
  bucket: Bucket
  sortKey: SortKey
  query: string
  index: number
}

export default function BucketSection({ bucket, sortKey, query, index }: Props) {
  const filtered = bucket.members.filter((c) => {
    if (!query) return true
    const q = query.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q)
  })
  const rows = sortCompanies(filtered, sortKey)

  const med = median(bucket.members.map((c) => c.ytdPct))
  const negative = bucket.members.filter((c) => c.ytdPct < 0).length
  const total = bucket.members.length

  return (
    <section className="mb-14 scroll-mt-24">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-2xl font-semibold text-ink-faint">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <h2 className="font-serif text-2xl font-bold leading-none tracking-tight text-ink sm:text-3xl">
              {bucket.label}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-snug text-ink-soft">{bucket.blurb}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-6 border-l border-rule pl-6">
          <Metric value={pct(med)} label="median YTD" tone={med >= 0 ? 'teal' : 'claret'} />
          <Metric value={`${negative}/${total}`} label="in the red" />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="border-t border-rule py-6 text-sm italic text-ink-soft">
          No names match “{query}”.
        </p>
      ) : (
        <div className="border-t-2 border-ink">
          {rows.map((c, i) => (
            <CompanyRow key={c.ticker} c={c} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  )
}

function Metric({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone?: 'teal' | 'claret'
}) {
  const color = tone === 'teal' ? 'text-teal' : tone === 'claret' ? 'text-claret' : 'text-ink'
  return (
    <div className="text-right">
      <div className={`tnum font-serif text-lg font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">{label}</div>
    </div>
  )
}
