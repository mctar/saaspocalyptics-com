import { useEffect, useState } from 'react'
import type { MarketData, SortKey } from './lib/types'
import Hero from './components/Hero'
import RecoveryArc from './components/RecoveryArc'
import SummaryStats from './components/SummaryStats'
import Filters from './components/Filters'
import BucketSection from './components/BucketSection'
import Scatter, { BUCKET_COLOR } from './components/Scatter'
import { allRows, type Lens } from './lib/brief'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: MarketData }

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [sortKey, setSortKey] = useState<SortKey>('ytd')
  const [query, setQuery] = useState('')
  const [lens, setLens] = useState<Lens>('all')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    fetch('data/market.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`market.json returned ${r.status}`)
        return r.json()
      })
      .then((data: MarketData) => setState({ status: 'ready', data }))
      .catch((e) => setState({ status: 'error', message: String(e.message ?? e) }))
  }, [])

  if (state.status === 'loading') return <Centered>Setting the type…</Centered>
  if (state.status === 'error') {
    return (
      <Centered>
        <div className="max-w-md text-center">
          <p className="mb-2 font-serif text-lg font-semibold text-claret">Couldn’t load market data.</p>
          <p className="text-sm text-ink-soft">{state.message}</p>
        </div>
      </Centered>
    )
  }

  const { data } = state
  const all = allRows(data)
  const history = data.history ?? []
  const benchName = (t: string) => data.benchmarks?.find((b) => b.ticker === t)?.name ?? t

  const allEntries = Object.entries(data.buckets)
  const categories = allEntries.map(([key, b]) => ({ key, label: b.label, color: BUCKET_COLOR[key] }))
  const shownEntries = allEntries.filter(([id]) => category === 'all' || id === category)

  return (
    <div className="min-h-screen">
      <Hero data={data} />

      {/* The recovery arc — the centerpiece of the .com edition */}
      {history.length > 1 && (
        <section className="mx-auto mt-12 max-w-5xl px-4">
          <SectionHead n="01" title="The arc of the correction">
            Median year-to-date return across all {all.length} names, against the software ETF and
            the S&amp;P 500 — the drawdown, the trough, and the climb back.
          </SectionHead>
          <RecoveryArc history={history} igvName={benchName('IGV')} spxName={benchName('^GSPC')} />
        </section>
      )}

      <SummaryStats all={all} />

      <main className="mx-auto max-w-5xl px-4">
        <Filters
          sortKey={sortKey}
          setSortKey={setSortKey}
          query={query}
          setQuery={setQuery}
          lens={lens}
          setLens={setLens}
          category={category}
          setCategory={setCategory}
          categories={categories}
        />
        {shownEntries.map(([id, bucket]) => (
          <BucketSection
            key={id}
            id={id}
            index={allEntries.findIndex(([k]) => k === id)}
            bucket={bucket}
            sortKey={sortKey}
            query={query}
            lens={lens}
            aiBlurb={data.ai?.buckets?.[id]}
          />
        ))}
      </main>

      {/* Fundamentals scatter — reflects the active lens + category */}
      <section className="mx-auto mb-14 max-w-5xl px-4">
        <SectionHead n="05" title="Does quality matter?">
          Rule of 40 against year-to-date return. If the market were rewarding fundamental quality,
          the cloud would tilt up and to the right — it only loosely does. The active lens highlights;
          the rest fade.
        </SectionHead>
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
          {shownEntries.map(([id, b]) => (
            <span key={id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BUCKET_COLOR[id] }} />
              {b.label}
            </span>
          ))}
        </div>
        <Scatter
          lens={lens}
          data={Object.fromEntries(shownEntries.map(([k, b]) => [k, b.members]))}
        />
      </section>

      <Methodology data={data} count={all.length} />
    </div>
  )
}

function SectionHead({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <span className="font-serif text-2xl font-semibold text-ink-faint">{n}</span>
      <div>
        <h2 className="font-serif text-2xl font-bold leading-none tracking-tight text-ink sm:text-3xl">
          {title}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-snug text-ink-soft">{children}</p>
      </div>
    </div>
  )
}

function Methodology({ data, count }: { data: MarketData; count: number }) {
  return (
    <footer className="border-t-2 border-ink">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="mb-3 font-serif text-xl font-bold text-ink">Methodology</h2>
        <div className="grid gap-x-10 gap-y-4 text-xs leading-relaxed text-ink-soft sm:grid-cols-2">
          <p>
            Daily closes via Yahoo Finance, refreshed a few times a day and split-adjusted.
            Year-to-date is measured from the first 2026 trading close. Non-USD names (Capgemini,
            TCS, Dassault) show local-currency prices; percentage changes are currency-neutral.
          </p>
          <p>
            The recovery arc reconstructs each day’s cross-sectional median from the full price
            history. Rule of 40 = revenue growth % + operating margin % (trailing, from Yahoo
            fundamentals), refreshed daily. The lenses cross-reference it with price: “quality on
            sale” is Rule of 40 ≥ 40 yet down on the year; “priced for hope” is under 25 yet up.
            Benchmarks: IGV and the S&amp;P 500. A single extreme mover is flagged as an outlier.
            Not investment advice.
          </p>
        </div>
        {data.ai?.model && (
          <p className="mt-4 max-w-3xl text-xs leading-relaxed text-ink-soft">
            The “today’s read”, the change note, and the category lines are written each run by a
            local <span className="font-semibold">{data.ai.model}</span> model on our own hardware,
            strictly from the figures above — it is given no news and told to invent nothing. If it
            is unavailable, the page falls back to computed text.
          </p>
        )}
        <p className="tnum mt-5 text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          Generated {data.generatedAt} · {count} names tracked · saaspocalyptics.com
        </p>
      </div>
    </footer>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 font-serif text-ink-soft">
      {children}
    </div>
  )
}
