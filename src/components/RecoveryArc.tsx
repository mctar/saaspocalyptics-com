import { useMemo, useRef, useState } from 'react'
import type { HistoryPoint } from '../lib/types'
import { formatDate } from '../lib/format'

const W = 920
const H = 360
const PAD = { top: 28, right: 18, bottom: 30, left: 44 }

const COLORS = {
  median: '#990F3D', // claret — the SaaS cohort
  igv: '#0D7680', // teal — software ETF
  spx: '#0F5499', // blue — S&P 500
  ink: '#2B2A28',
}

interface Series {
  key: 'median' | 'igv' | 'spx'
  label: string
  color: string
  values: (number | null)[]
}

export default function RecoveryArc({
  history,
  igvName,
  spxName,
}: {
  history: HistoryPoint[]
  igvName: string
  spxName: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const { series, x, y, zeroY, troughIdx, plotW } = useMemo(() => {
    const n = history.length
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom

    const series: Series[] = [
      { key: 'median', label: 'SaaS cohort (median)', color: COLORS.median, values: history.map((p) => p.medianYtd) },
      { key: 'igv', label: igvName, color: COLORS.igv, values: history.map((p) => p.igvYtd ?? null) },
      { key: 'spx', label: spxName, color: COLORS.spx, values: history.map((p) => p.spxYtd ?? null) },
    ]

    const all = series.flatMap((s) => s.values).filter((v): v is number => v != null)
    const lo = Math.min(0, ...all)
    const hi = Math.max(0, ...all)
    const padV = (hi - lo) * 0.08 || 1
    const yMin = lo - padV
    const yMax = hi + padV

    const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW)
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH
    const zeroY = y(0)

    let troughIdx = 0
    history.forEach((p, i) => {
      if (p.medianYtd < history[troughIdx].medianYtd) troughIdx = i
    })

    return { series, x, y, zeroY, troughIdx, plotW }
  }, [history, igvName, spxName])

  if (history.length < 2) return null

  const linePath = (vals: (number | null)[]) => {
    let d = ''
    let pen = false
    vals.forEach((v, i) => {
      if (v == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)} `
      pen = true
    })
    return d.trim()
  }

  const median = series[0]
  const areaPath =
    `M ${x(0).toFixed(1)} ${zeroY.toFixed(1)} ` +
    median.values.map((v, i) => `L ${x(i).toFixed(1)} ${y(v as number).toFixed(1)}`).join(' ') +
    ` L ${x(history.length - 1).toFixed(1)} ${zeroY.toFixed(1)} Z`

  const last = history[history.length - 1]
  const trough = history[troughIdx]
  const active = hover != null ? history[hover] : null
  const ai = hover ?? history.length - 1

  // y-axis ticks at sensible round percentages
  const tickVals = niceTicks(median, series)

  function onMove(e: React.MouseEvent) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((svgX - PAD.left) / plotW) * (history.length - 1))
    setHover(Math.max(0, Math.min(history.length - 1, i)))
  }

  return (
    <figure className="m-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="SaaS cohort year-to-date performance versus benchmarks"
      >
        {/* y gridlines + labels */}
        {tickVals.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={COLORS.ink} strokeOpacity={t === 0 ? 0.35 : 0.08} strokeWidth={1} strokeDasharray={t === 0 ? '0' : '2 4'} />
            <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" className="fill-ink-faint" fontSize="11" fontFamily="'Libre Franklin', sans-serif">
              {t > 0 ? '+' : ''}{t}%
            </text>
          </g>
        ))}

        {/* median area + benchmark lines + median line */}
        <path d={areaPath} fill={COLORS.median} fillOpacity={0.07} />
        {series.slice(1).map((s) => (
          <path key={s.key} d={linePath(s.values)} fill="none" stroke={s.color} strokeWidth={1.5} strokeOpacity={0.85} strokeLinejoin="round" />
        ))}
        <path d={linePath(median.values)} fill="none" stroke={COLORS.median} strokeWidth={2.6} strokeLinejoin="round" />

        {/* trough marker */}
        <circle cx={x(troughIdx)} cy={y(trough.medianYtd)} r={3.5} fill={COLORS.median} />
        <text x={x(troughIdx)} y={y(trough.medianYtd) + 20} textAnchor="middle" className="fill-claret" fontSize="11" fontWeight="600" fontFamily="'Libre Franklin', sans-serif">
          low {trough.medianYtd}% · {shortDate(trough.date)}
        </text>

        {/* end labels */}
        {series.map((s) => {
          const v = s.values[s.values.length - 1]
          if (v == null) return null
          return (
            <text key={s.key} x={W - PAD.right} y={y(v) + 3} textAnchor="end" fontSize="11" fontWeight="600" fill={s.color} fontFamily="'Libre Franklin', sans-serif">
              {v > 0 ? '+' : ''}{v}%
            </text>
          )
        })}

        {/* scrubber */}
        {active && (
          <g>
            <line x1={x(ai)} x2={x(ai)} y1={PAD.top} y2={H - PAD.bottom} stroke={COLORS.ink} strokeOpacity={0.35} strokeWidth={1} />
            {(['median', 'igv', 'spx'] as const).map((k, idx) => {
              const v = series[idx].values[ai]
              return v == null ? null : <circle key={k} cx={x(ai)} cy={y(v)} r={3} fill={series[idx].color} />
            })}
            <text x={x(ai)} y={PAD.top - 12} textAnchor={ai > history.length / 2 ? 'end' : 'start'} className="fill-ink" fontSize="12" fontWeight="600" fontFamily="'Source Serif 4', serif">
              {formatDate(active.date)}
            </text>
          </g>
        )}
      </svg>

      {/* legend + readout */}
      <figcaption className="mt-1 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <Key color={COLORS.median} label={`SaaS median ${fmt(active?.medianYtd ?? last.medianYtd)}`} bold />
          <Key color={COLORS.igv} label={`${igvName} ${fmt(active?.igvYtd ?? last.igvYtd)}`} />
          <Key color={COLORS.spx} label={`${spxName} ${fmt(active?.spxYtd ?? last.spxYtd)}`} />
        </div>
        <span className="font-sans text-ink-faint">
          {active ? `${active.pctUp}% above water` : 'hover to scrub the timeline'}
        </span>
      </figcaption>
    </figure>
  )
}

function Key({ color, label, bold }: { color: string; label: string; bold?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-soft">
      <span className="inline-block h-0.5 w-4" style={{ backgroundColor: color }} />
      <span className={`tnum ${bold ? 'font-semibold text-ink' : ''}`}>{label}</span>
    </span>
  )
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${mon[m - 1]}`
}

function niceTicks(median: Series, series: Series[]): number[] {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null)
  const lo = Math.min(0, ...all)
  const hi = Math.max(0, ...all)
  const step = 10
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)
  if (!ticks.includes(0)) ticks.push(0)
  void median
  return ticks
}
