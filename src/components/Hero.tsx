import type { Company } from '../lib/types'
import { pct, formatDate } from '../lib/format'

interface Props {
  asOf: string
  baselineDate: string
  all: Company[]
}

export default function Hero({ asOf, baselineDate, all }: Props) {
  const sorted = [...all].sort((a, b) => b.ytdPct - a.ytdPct)
  const winner = sorted[0]
  const loser = sorted[sorted.length - 1]
  const belowStart = all.filter((c) => c.ytdPct < 0).length

  return (
    <header className="mx-auto max-w-5xl px-4 pt-6">
      {/* Masthead */}
      <div className="draw-rule h-1 bg-ink" />
      <div className="flex items-baseline justify-between gap-4 py-3">
        <span className="font-serif text-lg font-bold uppercase tracking-[0.18em] text-ink sm:text-xl">
          SaaSpocalyptics
        </span>
        <span className="text-right text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft sm:text-xs">
          A market report · {formatDate(asOf)}
        </span>
      </div>
      <div className="h-px bg-rule" />

      {/* Headline + standfirst, two-column editorial layout on desktop */}
      <div className="grid grid-cols-1 gap-x-10 gap-y-4 py-10 sm:grid-cols-[1.55fr_1fr] sm:py-14">
        <div className="fade-up">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-claret">
            The SaaSpocalypse · Year to date 2026
          </p>
          <h1 className="font-serif text-5xl font-bold leading-[0.98] tracking-tight text-ink sm:text-7xl">
            After the reckoning.
          </h1>
        </div>
        <div className="fade-up self-end border-l-0 sm:border-l sm:border-rule sm:pl-10" style={{ animationDelay: '0.12s' }}>
          <p className="font-serif text-lg leading-relaxed text-ink sm:text-xl">
            Investors stopped dumping software indiscriminately and started sorting winners from
            losers — crudely.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            A live ledger of the major SaaS names, the heavyweights the index won’t yet admit, and
            the integrators in their orbit — measured from the first trading day of 2026.
          </p>
        </div>
      </div>

      {/* "By the numbers" strip */}
      <div className="fade-up grid grid-cols-2 border-y-2 border-ink sm:grid-cols-4" style={{ animationDelay: '0.2s' }}>
        <Stat label="Biggest winner" value={pct(winner.ytdPct)} sub={winner.name} tone="teal" border />
        <Stat label="Biggest loser" value={pct(loser.ytdPct)} sub={loser.name} tone="claret" border />
        <Stat label="Below 2026 start" value={`${belowStart}/${all.length}`} sub="still under water" border />
        <Stat label="Baseline" value={formatDate(baselineDate)} sub="first 2026 close" />
      </div>
    </header>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
  border,
}: {
  label: string
  value: string
  sub: string
  tone?: 'teal' | 'claret'
  border?: boolean
}) {
  const valueColor = tone === 'teal' ? 'text-teal' : tone === 'claret' ? 'text-claret' : 'text-ink'
  return (
    <div
      className={`px-4 py-4 ${border ? 'border-rule sm:border-r' : ''} ${
        // 2x2 on mobile: give the top row a divider
        'border-b border-rule sm:border-b-0'
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </div>
      <div className={`tnum mt-1 font-serif text-2xl font-semibold leading-none sm:text-3xl ${valueColor}`}>
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-ink-soft">{sub}</div>
    </div>
  )
}
