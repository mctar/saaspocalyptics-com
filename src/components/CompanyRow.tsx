import type { Company } from '../lib/types'
import { pct, price } from '../lib/format'
import Sparkline from './Sparkline'

export default function CompanyRow({ c, rank }: { c: Company; rank: number }) {
  const up = c.ytdPct >= 0
  const ytdColor = up ? 'text-teal' : 'text-claret'
  const f = c.fundamentals

  return (
    <div className="group grid grid-cols-[1.4rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule px-3 py-2.5 transition-colors last:border-b-0 odd:bg-paper2/40 hover:bg-card sm:grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_5.5rem_auto] sm:gap-4 sm:px-4">
      {/* rank */}
      <span className="font-sans text-xs tabular-nums text-ink-faint">
        {String(rank).padStart(2, '0')}
      </span>

      {/* name + ticker */}
      <div className="min-w-0">
        <div className="truncate font-serif text-[1.05rem] font-semibold leading-tight text-ink">
          {c.name}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
          <span className="font-sans font-semibold uppercase tracking-[0.12em]">{c.ticker}</span>
          <span className="tnum text-ink-faint">
            {price(c.last, c.currency)}
            {c.currency !== 'USD' && <span className="ml-1">{c.currency}</span>}
          </span>
        </div>
      </div>

      {/* YTD — the headline figure, set in serif like an editorial number */}
      <div className={`tnum text-right font-serif text-xl font-semibold sm:text-2xl ${ytdColor}`}>
        {pct(c.ytdPct)}
      </div>

      {/* fundamentals — rule-of-40 + revenue growth, hidden on narrow screens */}
      <div className="hidden text-right sm:block">
        {f?.ruleOf40 != null ? (
          <>
            <div className={`tnum font-sans text-sm font-semibold ${rule40Color(f.ruleOf40)}`}>
              {f.ruleOf40.toFixed(0)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              R40{f.revenueGrowthPct != null ? ` · ${f.revenueGrowthPct.toFixed(0)}% grw` : ''}
            </div>
          </>
        ) : (
          <div className="tnum text-sm text-ink-faint">—</div>
        )}
      </div>

      {/* sparkline */}
      <div className="justify-self-end">
        <span className="hidden sm:block">
          <Sparkline values={c.sparkline} positive={up} width={132} height={30} />
        </span>
        <span className="block sm:hidden">
          <Sparkline values={c.sparkline} positive={up} width={68} height={24} />
        </span>
      </div>
    </div>
  )
}

// Rule of 40: ≥40 healthy (teal), 25–40 middling (ink), <25 weak (claret).
function rule40Color(v: number): string {
  if (v >= 40) return 'text-teal'
  if (v >= 25) return 'text-ink'
  return 'text-claret'
}
