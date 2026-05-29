import type { Company } from '../lib/types'

/**
 * One distribution bar in the editorial palette: how the whole universe splits
 * into deep losers, mild losers, and winners. A single glance at the breadth.
 */
export default function SummaryStats({ all }: { all: Company[] }) {
  const total = all.length
  const deep = all.filter((c) => c.ytdPct <= -25).length
  const mild = all.filter((c) => c.ytdPct < 0 && c.ytdPct > -25).length
  const up = all.filter((c) => c.ytdPct >= 0).length

  const seg = (n: number) => `${(n / total) * 100}%`

  return (
    <div className="mx-auto mb-14 mt-12 max-w-5xl px-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
          The spread · {total} companies
        </span>
      </div>
      <div className="flex h-3 overflow-hidden border border-ink">
        <div className="bg-claret" style={{ width: seg(deep) }} title={`${deep} down ≥25%`} />
        <div className="bg-claret/35" style={{ width: seg(mild) }} title={`${mild} down <25%`} />
        <div className="bg-teal" style={{ width: seg(up) }} title={`${up} up YTD`} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-7 gap-y-1.5 text-xs text-ink-soft">
        <Legend swatch="bg-claret" label={`${deep} down 25%+`} />
        <Legend swatch="bg-claret/35" label={`${mild} down under 25%`} />
        <Legend swatch="bg-teal" label={`${up} up YTD`} />
      </div>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 ${swatch}`} />
      <span className="tnum">{label}</span>
    </span>
  )
}
